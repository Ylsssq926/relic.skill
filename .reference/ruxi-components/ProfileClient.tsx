'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { WorldCard } from '@/components/WorldCard';
import type { WorldData } from '@/components/WorldCard';
import { useAuth } from '@/lib/auth-context';
import { SITE_CONFIG } from '@/config/site';
import { applyWorldStatsUpdate, WORLD_STATS_UPDATED_EVENT, type WorldStatsUpdateDetail, userAPI, authAPI } from '@/lib/api';
import { toast } from '@/lib/toast';
import { getDisplayInitial, getTextLength, normalizeWorlds, truncateText } from '@/lib/utils';

interface PlaySession {
  id: string;
  worldTitle: string;
  genre: string;
  status: string;
  progress: string;
  lastPlayed: string;
  updatedAt?: string;
  protagonist_name?: string;
}

interface CreditLog {
  id: string;
  desc: string;
  amount: number;
  date: string;
  balanceAfter: number | null;
}

interface Achievement {
  id: number;
  key: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  unlocked: boolean;
  unlocked_at: string | null;
}

type Tab = 'history' | 'favorites' | 'achievements' | 'settings';

const TABS: { key: Tab; label: string; mobileLabel: string }[] = [
  { key: 'history', label: '我的故事', mobileLabel: '故事' },
  { key: 'favorites', label: '收藏夹', mobileLabel: '收藏' },
  { key: 'achievements', label: '成就墙', mobileLabel: '成就' },
  { key: 'settings', label: '账号与补给', mobileLabel: '账号' },
];

const CREDIT_LOG_PREVIEW_COUNT = 5;
const ACHIEVEMENT_CATEGORY_LABELS: Record<string, string> = {
  play: '游玩',
  create: '创作',
  social: '互动',
};

const AVATAR_MAX_DIMENSION = SITE_CONFIG.limits.auth.avatarMaxDimension;
const AVATAR_MAX_UPLOAD_BYTES = SITE_CONFIG.limits.auth.avatarUploadBytes;
const AVATAR_MAX_UPLOAD_KB = Math.round(AVATAR_MAX_UPLOAD_BYTES / 1024);
const AVATAR_ACCEPT_TYPES = 'image/png,image/jpeg,image/webp';
const PROFILE_BIO_MAX_LENGTH = 500;

function resolveTabFromQuery(requestedTab: string | null): Tab {
  if (requestedTab === 'favorites' || requestedTab === 'achievements' || requestedTab === 'history') {
    return requestedTab;
  }
  if (requestedTab === 'settings' || requestedTab === 'credits') {
    return 'settings';
  }
  return 'history';
}

function getTabQueryValue(tab: Tab): string | null {
  if (tab === 'history') return null;
  if (tab === 'settings') return 'credits';
  return tab;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result) {
        resolve(reader.result);
        return;
      }
      reject(new Error('读取图片失败'));
    };
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = src;
  });
}

function getDataUriByteSize(dataUri: string): number {
  const base64 = dataUri.split(',')[1] || '';
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(base64.length * 3 / 4) - padding);
}

async function compressAvatarFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件');
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImageElement(sourceDataUrl);
  const longestSide = Math.max(image.width, image.height) || 1;
  const scale = Math.min(1, AVATAR_MAX_DIMENSION / longestSide);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('图片处理失败');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
  if (getDataUriByteSize(compressedDataUrl) > AVATAR_MAX_UPLOAD_BYTES) {
    throw new Error(`压缩后仍超过 ${AVATAR_MAX_UPLOAD_KB}KB，请换一张更小的图片`);
  }

  return compressedDataUrl;
}

/* ── Page ──────────────────────────────────────────────── */

export default function ProfilePage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const profileRedirectPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const [tab, setTab] = useState<Tab>('history');
  const [editingNickname, setEditingNickname] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const { user, loading: authLoading, logout, refreshUser } = useAuth();
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [history, setHistory] = useState<PlaySession[]>([]);
  const [favorites, setFavorites] = useState<WorldData[]>([]);
  const [credits, setCredits] = useState<CreditLog[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [pwForm, setPwForm] = useState({ old: '', new: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [nicknameSubmitting, setNicknameSubmitting] = useState(false);
  const [bioSubmitting, setBioSubmitting] = useState(false);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string | null>(null);
  const [showAllCredits, setShowAllCredits] = useState(false);

  useEffect(() => {
    if (user) {
      setNickname(user.nickname);
      setBio(user.bio || '');
    }
  }, [user]);

  useEffect(() => {
    setUploadedAvatarUrl(user?.avatar_url || null);
  }, [user?.avatar_url]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const patchFavoriteWorlds = useCallback((list: WorldData[], detail: WorldStatsUpdateDetail) => {
    const nextList = list
      .map((item) => applyWorldStatsUpdate(item as unknown as Record<string, unknown>, detail) as unknown as WorldData)
      .filter((item) => !(detail.isFavorited === false && String(item.id) === detail.id));
    return nextList.length !== list.length || nextList.some((item, index) => item !== list[index]) ? nextList : list;
  }, []);

  useEffect(() => {
    const handleWorldStatsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<WorldStatsUpdateDetail>).detail;
      if (!detail?.id) return;
      setFavorites((prev) => patchFavoriteWorlds(prev, detail));
    };

    window.addEventListener(WORLD_STATS_UPDATED_EVENT, handleWorldStatsUpdated);
    return () => window.removeEventListener(WORLD_STATS_UPDATED_EVENT, handleWorldStatsUpdated);
  }, [patchFavoriteWorlds]);

  useEffect(() => {
    setTab(resolveTabFromQuery(searchParams.get('tab')));
  }, [searchParams]);

  useEffect(() => {
    if (tab !== 'settings' && showAllCredits) {
      setShowAllCredits(false);
    }
  }, [showAllCredits, tab]);

  const handleTabChange = useCallback((nextTab: Tab) => {
    setTab(nextTab);
    const nextParams = new URLSearchParams(searchParams.toString());
    const nextTabQueryValue = getTabQueryValue(nextTab);
    if (nextTabQueryValue) {
      nextParams.set('tab', nextTabQueryValue);
    } else {
      nextParams.delete('tab');
    }
    const nextQueryString = nextParams.toString();
    router.replace(nextQueryString ? `${pathname}?${nextQueryString}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const fetchProfileData = useCallback(async (signal?: AbortSignal) => {
    if (!user) {
      if (!mountedRef.current) return;
      setDataLoading(false);
      setDataError('');
      return;
    }

    if (!mountedRef.current) return;
    setDataLoading(true);
    setDataError('');

    const requestOptions = signal ? { signal } : undefined;
    const { userDataPageLimit } = SITE_CONFIG.pagination;
    const [historyRes, favRes, creditsRes, achievementsRes] = await Promise.allSettled([
      userAPI.getHistory({ limit: userDataPageLimit }, requestOptions),
      userAPI.getFavorites({ limit: userDataPageLimit }, requestOptions),
      userAPI.getCredits({ limit: userDataPageLimit }, requestOptions),
      userAPI.getAchievements(requestOptions),
    ]);

    if (signal?.aborted || !mountedRef.current) return;

    const fulfilledCount = [historyRes, favRes, creditsRes, achievementsRes].filter((item) => item.status === 'fulfilled').length;

    if (historyRes.status === 'fulfilled') {
      const d = historyRes.value.data || historyRes.value;
      const rawSessions = d.sessions || d;
      setHistory(Array.isArray(rawSessions) ? rawSessions.map((s: Record<string, unknown>) => {
        const status = typeof s.status === 'string' ? s.status : 'completed';
        return {
          id: String(s.id),
          worldTitle: (s.world_title as string) || (s.worldTitle as string) || '未知世界',
          genre: (s.genre as string) || '',
          status,
          progress: status === 'active' ? '进行中' : status === 'abandoned' ? '已放弃' : '已完成',
          lastPlayed: s.updated_at ? new Date(s.updated_at as string).toLocaleDateString('zh-CN') : ((s.lastPlayed as string) || ''),
          updatedAt: (s.updated_at as string) || (s.lastPlayed as string) || '',
          protagonist_name: s.protagonist_name as string | undefined,
        };
      }) : []);
    }
    if (favRes.status === 'fulfilled') {
      const d = favRes.value.data || favRes.value;
      const rawWorlds = d.worlds || d;
      setFavorites(Array.isArray(rawWorlds) ? normalizeWorlds(rawWorlds as Record<string, unknown>[]) : []);
    }
    if (creditsRes.status === 'fulfilled') {
      const d = creditsRes.value.data || creditsRes.value;
      const rawLogs = d.logs || d;
      setCredits(Array.isArray(rawLogs) ? rawLogs.map((l: Record<string, unknown>) => ({
        id: String(l.id),
        desc: (l.reason as string) || (l.desc as string) || '',
        amount: l.amount as number,
        date: l.created_at ? new Date(l.created_at as string).toLocaleString('zh-CN') : ((l.date as string) || ''),
        balanceAfter: l.balance_after != null ? Number(l.balance_after) : (l.balanceAfter != null ? Number(l.balanceAfter) : null),
      })) : []);
    }
    if (achievementsRes.status === 'fulfilled') {
      const d = achievementsRes.value.data || achievementsRes.value;
      setAchievements(Array.isArray(d) ? d : []);
    }

    if (fulfilledCount === 0) {
      setDataError('数据加载失败，请重试');
    } else if (fulfilledCount < 4) {
      setDataError('部分数据加载失败，已显示可用内容');
    }

    setDataLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      void fetchProfileData(controller.signal);
      return () => {
        controller.abort();
      };
    }
    if (!authLoading) {
      setDataLoading(false);
      setDataError('');
    }
  }, [user, authLoading, fetchProfileData]);

  const handleSaveNickname = async () => {
    const trimmedNickname = nickname.trim();
    if (getTextLength(trimmedNickname) < 2 || getTextLength(trimmedNickname) > 16) {
      toast.error('昵称需要 2-16 个字符');
      return;
    }
    if (nicknameSubmitting) return;
    if (trimmedNickname === (user?.nickname || '').trim()) {
      setEditingNickname(false);
      toast.info('昵称没有变化');
      return;
    }
    const n = trimmedNickname;
    setNicknameSubmitting(true);
    try {
      await authAPI.updateMe({ nickname: n });
      await refreshUser();
      if (!mountedRef.current) return;
      setEditingNickname(false);
      toast.success('昵称修改成功');
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[Profile] updateMe failed:', err);
      toast.error('昵称修改失败，请重试');
    } finally {
      if (mountedRef.current) setNicknameSubmitting(false);
    }
  };

  const handleCancelNicknameEdit = () => {
    setNickname(user?.nickname || '');
    setEditingNickname(false);
  };

  const handleSaveBio = async () => {
    const trimmedBio = bio.trim();
    if (bioSubmitting) return;
    if (trimmedBio === (user?.bio || '').trim()) {
      setEditingBio(false);
      toast.info('个人简介没有变化');
      return;
    }

    setBioSubmitting(true);
    try {
      await authAPI.updateMe({ bio: trimmedBio });
      await refreshUser();
      if (!mountedRef.current) return;
      setEditingBio(false);
      toast.success(trimmedBio ? '个人简介已更新' : '个人简介已清空');
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[Profile] update bio failed:', err);
      toast.error('个人简介更新失败，请重试');
    } finally {
      if (mountedRef.current) setBioSubmitting(false);
    }
  };

  const handleCancelBioEdit = () => {
    setBio(user?.bio || '');
    setEditingBio(false);
  };

  const handleAvatarButtonClick = () => {
    if (avatarUploading) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setAvatarUploading(true);
    try {
      const compressedAvatar = await compressAvatarFile(file);
      const uploadRes = await authAPI.uploadAvatar(compressedAvatar);
      const uploadedUser = uploadRes.data || uploadRes;
      if (mountedRef.current) {
        setUploadedAvatarUrl(typeof uploadedUser.avatar_url === 'string' && uploadedUser.avatar_url.trim() ? uploadedUser.avatar_url : compressedAvatar);
      }
      await refreshUser();
      if (!mountedRef.current) return;
      toast.success('头像上传成功');
    } catch (err) {
      if (!mountedRef.current) return;
      console.error('[Profile] uploadAvatar failed:', err);
      toast.error(err instanceof Error ? err.message : '头像上传失败，请重试');
    } finally {
      if (mountedRef.current) setAvatarUploading(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess('');
    if (!pwForm.old || !pwForm.new || !pwForm.confirm) {
      setPwError('请填写完整信息');
      return;
    }
    if (pwForm.new.length < SITE_CONFIG.limits.auth.passwordMinLength) {
      setPwError(`新密码至少 ${SITE_CONFIG.limits.auth.passwordMinLength} 位`);
      return;
    }
    if (pwForm.new.length > SITE_CONFIG.limits.auth.passwordMaxLength) {
      setPwError(`新密码不能超过 ${SITE_CONFIG.limits.auth.passwordMaxLength} 个字符`);
      return;
    }
    if (pwForm.new !== pwForm.confirm) {
      setPwError('两次密码不一致');
      return;
    }
    setPwSubmitting(true);
    try {
      await authAPI.changePassword(pwForm.old, pwForm.new);
      if (!mountedRef.current) return;
      setPwSuccess('密码修改成功');
      setPwForm({ old: '', new: '', confirm: '' });
      toast.success('密码修改成功');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : '修改失败，请重试';
      setPwError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setPwSubmitting(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const targetSession = history.find((session) => session.id === sessionId);
    const confirmed = window.confirm(
      targetSession?.status === 'active'
        ? '确定要删除这段进行中的游玩记录吗？故事内容、存档和分享记录都会一并删除，且无法恢复。'
        : '确定要删除这条游玩记录吗？故事内容、存档和分享记录都会一并删除，且无法恢复。'
    );
    if (!confirmed) return;

    setDeletingSessionId(sessionId);
    try {
      await userAPI.deleteHistorySession(Number(sessionId));
      if (!mountedRef.current) return;
      setHistory((prev) => prev.filter((s) => s.id !== sessionId));
      toast.success('游玩记录已删除');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      toast.error(err instanceof Error ? err.message : '删除失败，请重试');
    } finally {
      if (mountedRef.current) setDeletingSessionId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      setDeleteError('请输入密码');
      return;
    }

    setDeleteSubmitting(true);
    setDeleteError('');
    try {
      await authAPI.deleteAccount(deletePassword);
      if (!mountedRef.current) return;
      logout();
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : '删除失败';
      setDeleteError(message);
      toast.error(message);
    } finally {
      if (mountedRef.current) setDeleteSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md animate-pulse space-y-4 py-8">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!user && !authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-400">
        <p className="text-base">这里是你的地盘，先登录再进来。</p>
        <Link href={`/auth?redirect=${encodeURIComponent(profileRedirectPath)}`} className="ui-btn ui-btn-primary mt-4 rounded-lg px-6 py-2 text-sm">
          去登录
        </Link>
      </div>
    );
  }

  const displayUser = user || { nickname: '...', avatar_url: null, bio: '', level: 'free', credits: 0 };
  const displayNickname = displayUser.nickname?.trim() || '未命名玩家';
  const resolvedAvatarUrl = uploadedAvatarUrl || displayUser.avatar_url || null;
  const membershipTierName = SITE_CONFIG.tierNames[user?.level || 'free'] || '免费版';
  const statusRank: Record<string, number> = { active: 0, completed: 1, abandoned: 2 };
  const historyStatusStyles: Record<string, string> = {
    active: 'bg-brand/10 text-brand',
    completed: 'bg-emerald-50 text-emerald-600',
    abandoned: 'bg-gray-100 text-gray-500',
  };
  const sortedHistory = [...history].sort((left, right) => {
    const leftRank = statusRank[left.status] ?? 99;
    const rightRank = statusRank[right.status] ?? 99;
    if (leftRank !== rightRank) return leftRank - rightRank;
    const leftTime = Date.parse(left.updatedAt || '') || 0;
    const rightTime = Date.parse(right.updatedAt || '') || 0;
    return rightTime - leftTime;
  });
  const historyGroups = [
    { key: 'active', title: '进行中', sessions: sortedHistory.filter((session) => session.status === 'active') },
    { key: 'completed', title: '已完成', sessions: sortedHistory.filter((session) => session.status === 'completed') },
    { key: 'abandoned', title: '已放弃', sessions: sortedHistory.filter((session) => session.status === 'abandoned') },
    { key: 'other', title: '其他', sessions: sortedHistory.filter((session) => !['active', 'completed', 'abandoned'].includes(session.status)) },
  ].filter((group) => group.sessions.length > 0);
  const activeSessions = sortedHistory.filter((session) => session.status === 'active');
  const featuredSession = activeSessions[0] || sortedHistory[0] || null;
  const unlockedAchievements = achievements.filter((achievement) => achievement.unlocked).length;
  const latestUnlockedAchievement = [...achievements]
    .filter((achievement) => achievement.unlocked)
    .sort((left, right) => {
      const leftTime = Date.parse(left.unlocked_at || '') || 0;
      const rightTime = Date.parse(right.unlocked_at || '') || 0;
      return rightTime - leftTime;
    })[0] || null;
  const remainingAchievementCount = Math.max(achievements.length - unlockedAchievements, 0);
  const remainingFreePlays = user?.daily_free_plays ?? SITE_CONFIG.app.dailyFreePlays;
  const hasFreeTurns = remainingFreePlays > 0;
  const hasCreditsAvailable = displayUser.credits > 0;
  const hasNoContinueBudget = !hasFreeTurns && !hasCreditsAvailable;
  const continueHref = featuredSession ? `/play/${featuredSession.id}` : '/explore';
  const continueLabel = featuredSession && featuredSession.status === 'active'
    ? '接着上次那段'
    : featuredSession
      ? '翻回上一段'
      : '去逛逛新世界';
  const continueHint = featuredSession
    ? `《${featuredSession.worldTitle}》${featuredSession.protagonist_name ? ` · ${featuredSession.protagonist_name}` : ''}`
    : '还没开场，先去挑个世界。';
  const continueActionLabel = featuredSession
    ? (featuredSession.status === 'active' ? '接着玩' : '回去看看')
    : '去探索';
  const balanceSummary = hasNoContinueBudget
    ? '今天额度用完了，先补一点再回来。'
    : hasFreeTurns
      ? `今天还剩 ${remainingFreePlays} 次免费互动，先用它。`
      : `现在还有 ${displayUser.credits} 积分，想继续就点进去。`;
  const visibleCreditLogs = showAllCredits ? credits : credits.slice(0, CREDIT_LOG_PREVIEW_COUNT);
  const hasMoreCreditLogs = credits.length > CREDIT_LOG_PREVIEW_COUNT;
  const tabBadges: Partial<Record<Tab, string>> = {
    history: activeSessions.length > 0 ? `${activeSessions.length} 进行中` : sortedHistory.length > 0 ? `${sortedHistory.length}` : '',
    favorites: favorites.length > 0 ? String(favorites.length) : '',
    achievements: achievements.length > 0 ? `${unlockedAchievements}/${achievements.length}` : '',
    settings: `${displayUser.credits} 积分`,
  };
  const latestCreditLog = credits[0] || null;
  const latestCreditSummary = latestCreditLog
    ? `${latestCreditLog.desc}（${latestCreditLog.amount > 0 ? '+' : ''}${latestCreditLog.amount}）`
    : '最近还没动过积分';
  const settingsSummaryItems = [
    {
      label: '当前方案',
      value: membershipTierName,
      note: membershipTierName === '高级版' ? '常回来的人会更顺手' : '常回来时再看看会员',
    },
    {
      label: '积分与免费互动',
      value: `${displayUser.credits} 积分 · ${remainingFreePlays} 次`,
      note: hasNoContinueBudget ? '现在更适合先补一点' : '继续时会先用免费次数',
    },
    {
      label: '最近动静',
      value: latestCreditSummary,
      note: latestCreditLog?.date || '到账和消耗都会记在这里。',
    },
  ];
  const heroStatusText = hasNoContinueBudget
    ? '今天先补一点，回来还能接着演。'
    : featuredSession
      ? featuredSession.status === 'active'
        ? '你有一段还没散场，点开就能接上。'
        : '最近玩过的那段还在，想回看就点开。'
      : '这里先空着，等你去挑第一段故事。';
  const profileOverviewCards = [
    {
      label: '我的积分',
      value: String(displayUser.credits),
      note: hasCreditsAvailable ? '够继续玩' : '可以先补一点',
    },
    {
      label: '今天免费',
      value: `${remainingFreePlays} 次`,
      note: hasFreeTurns ? '会先用这个' : '今天已经用完',
    },
    {
      label: '在追故事',
      value: String(activeSessions.length),
      note: activeSessions.length > 0 ? '回来先接这几段' : '暂时还没有',
    },
    {
      label: '收藏 / 成就',
      value: `${favorites.length} / ${unlockedAchievements}`,
      note: favorites.length > 0 || unlockedAchievements > 0 ? '都在这儿' : '慢慢攒起来',
    },
  ];
  const activeTabMeta = tab === 'history'
    ? {
        eyebrow: '我的故事',
        title: featuredSession ? `《${featuredSession.worldTitle}》还在等你` : '这里收着你玩过的故事',
        description: activeSessions.length > 0
          ? `有 ${activeSessions.length} 段还没散场，点开就能接着演。`
          : sortedHistory.length > 0
            ? '玩过的都放在这儿，想翻哪段就翻哪段。'
            : '还没开场，先去挑个世界。',
      }
    : tab === 'favorites'
      ? {
          eyebrow: '收藏夹',
          title: favorites.length > 0 ? '喜欢的都收在这儿' : '收藏夹还空着',
          description: favorites.length > 0
            ? '想重开、回看设定，来这儿翻最快。'
            : '逛到喜欢的世界就先收下，之后回来很好找。',
        }
      : tab === 'achievements'
        ? {
            eyebrow: '成就墙',
            title: achievements.length > 0 ? `已经点亮 ${unlockedAchievements} / ${achievements.length}` : '成就墙等你来点亮',
            description: latestUnlockedAchievement
              ? `最近亮起：${latestUnlockedAchievement.name}。继续玩，还会一格格亮下去。`
              : '多玩、多逛、多收藏，墙就会慢慢亮起来。',
          }
        : {
            eyebrow: '账号与补给',
            title: '账号、补给都收在这儿',
            description: '常用的入口一次看完，不用来回翻。',
          };
  const activeTabMobileDescription = truncateText(activeTabMeta.description, 38);

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-4 pb-[5.8rem] sm:px-6 sm:py-8 sm:pb-8 xl:px-8">
      {/* Data Error */}
      {dataError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          <p>{dataError}</p>
          <button
            type="button"
            onClick={() => { void fetchProfileData(); }}
            className="ui-btn ui-btn-secondary mt-2 rounded-lg px-4 py-2 text-sm"
          >
            重试
          </button>
        </div>
      )}
      <div className="mb-6">
        <div className="ui-panel overflow-hidden p-0">
          <div className="bg-gradient-to-br from-brand-dark via-brand to-brand-light px-4 py-4 text-white sm:px-6 sm:py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 gap-4">
                <div className="flex shrink-0 flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    disabled={avatarUploading}
                    className="group relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-white/30 transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70 sm:h-20 sm:w-20"
                    aria-label="上传头像"
                  >
                    {resolvedAvatarUrl ? (
                      <Image
                        src={resolvedAvatarUrl}
                        alt={`${displayNickname} 的头像`}
                        fill
                        sizes="80px"
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white sm:text-3xl">
                        {getDisplayInitial(displayNickname)}
                      </span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      {avatarUploading ? '上传中' : '更换头像'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    disabled={avatarUploading}
                    className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/50"
                  >
                    {avatarUploading ? '上传中...' : '更换头像'}
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept={AVATAR_ACCEPT_TYPES}
                    className="hidden"
                    onChange={(event) => { void handleAvatarChange(event); }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/85">
                      我的地盘
                    </span>
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90">
                      {membershipTierName}
                    </span>
                  </div>
                  <h1 className="mt-3 break-words text-2xl font-bold text-white sm:text-3xl">{displayNickname}</h1>
                  <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-white/88 sm:leading-7">
                    {displayUser.bio || '留一句签名吧，让这里更像你。'}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:hidden">
                    {profileOverviewCards.map((item) => (
                      <div key={item.label} className="rounded-[1rem] border border-white/12 bg-white/10 px-3 py-3 backdrop-blur-sm">
                        <p className="text-[10px] text-white/68">{item.label}</p>
                        <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                        <p className="mt-1 text-[10px] leading-4 text-white/62">{item.note}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 hidden flex-wrap gap-2 text-xs sm:flex">
                    <span className="rounded-full bg-white/12 px-3 py-1.5 font-medium text-white/90">进行中 {activeSessions.length}</span>
                    <span className="rounded-full bg-white/12 px-3 py-1.5 font-medium text-white/90">收藏 {favorites.length}</span>
                    <span className="rounded-full bg-white/12 px-3 py-1.5 font-medium text-white/90">成就 {unlockedAchievements}</span>
                  </div>
                  <p className="mt-4 hidden text-sm text-white/80 sm:block">{heroStatusText}</p>

                  <div className="mt-4 rounded-[1.35rem] border border-white/15 bg-white/10 p-3 backdrop-blur-sm md:hidden">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-white/72">随手入口</p>
                    <p className="mt-2 text-sm font-semibold text-white">{continueLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-white/78">{balanceSummary}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => router.push(continueHref)}
                        className="ui-btn rounded-2xl bg-white px-4 py-3 text-sm text-brand hover:bg-white/90"
                      >
                        {continueActionLabel}
                      </button>
                      {hasNoContinueBudget ? (
                        <Link
                          href="/recharge"
                          className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                        >
                          先去补给
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleTabChange('settings')}
                          className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                        >
                          账号与补给
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden w-full max-w-[21rem] rounded-[1.6rem] bg-white/10 p-4 backdrop-blur-sm md:block">
                <p className="text-xs font-semibold tracking-[0.18em] text-white/70">先从这儿开始</p>
                <p className="mt-2 text-sm font-semibold text-white">{continueLabel}</p>
                <p className="mt-1 break-words text-sm text-white/82">{continueHint}</p>
                <p className="mt-2 text-xs leading-5 text-white/72">{balanceSummary}</p>

                <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-xs text-white/70">最近动静</p>
                  <p className="mt-1 text-sm font-semibold text-white">{latestCreditSummary}</p>
                  <p className="mt-1 text-xs leading-5 text-white/70">{latestCreditLog?.date || '有新动静时，这里会先告诉你。'}</p>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <button
                    type="button"
                    onClick={() => router.push(continueHref)}
                    className="ui-btn rounded-2xl bg-white px-4 py-3 text-sm text-brand hover:bg-white/90"
                  >
                    {continueActionLabel}
                  </button>
                  {hasNoContinueBudget ? (
                    <Link
                      href="/recharge"
                      className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                    >
                      先去补给
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleTabChange('settings')}
                      className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
                    >
                      积分与账号
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="hidden gap-3 border-t border-gray-100 bg-white px-4 py-4 sm:grid sm:px-5 sm:py-5 lg:grid-cols-4">
            {profileOverviewCards.map((item) => (
              <div key={item.label} className="rounded-2xl bg-gray-50 px-4 py-4">
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{item.value}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-4 mb-4 overflow-x-auto bg-white/95 px-4 py-2 backdrop-blur-sm hide-scrollbar sm:static sm:mx-0 sm:mb-4 sm:bg-transparent sm:px-0 sm:py-0">
        <div role="tablist" className="flex w-max min-w-full gap-2 rounded-full bg-gray-100 p-1 shadow-sm sm:shadow-none">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => handleTabChange(t.key)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-all active:scale-[0.98] cursor-pointer ${
                tab === t.key ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="sm:hidden">{t.mobileLabel}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {tabBadges[t.key] ? (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${tab === t.key ? 'bg-brand/10 text-brand' : 'bg-white text-gray-500'}`}>
                    {tabBadges[t.key]}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 rounded-[1.7rem] border border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">{activeTabMeta.eyebrow}</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900 sm:text-xl">{activeTabMeta.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600 sm:hidden">{activeTabMobileDescription}</p>
            <p className="mt-2 hidden text-sm leading-6 text-gray-600 sm:block">{activeTabMeta.description}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {tab === 'history' ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push(continueHref)}
                  className="ui-btn ui-btn-primary rounded-xl px-4 py-2.5 text-sm"
                >
                  {continueActionLabel}
                </button>
                <Link href="/explore" className="ui-btn ui-btn-secondary rounded-xl px-4 py-2.5 text-sm">
                  去探索
                </Link>
              </>
            ) : null}
            {tab === 'favorites' ? (
              <>
                <Link href="/explore" className="ui-btn ui-btn-primary rounded-xl px-4 py-2.5 text-sm">
                  去逛新世界
                </Link>
                <button
                  type="button"
                  onClick={() => handleTabChange('history')}
                  className="ui-btn ui-btn-secondary rounded-xl px-4 py-2.5 text-sm"
                >
                  回我的故事
                </button>
              </>
            ) : null}
            {tab === 'achievements' ? (
              <>
                <Link href="/explore" className="ui-btn ui-btn-primary rounded-xl px-4 py-2.5 text-sm">
                  去点亮下一格
                </Link>
                <button
                  type="button"
                  onClick={() => handleTabChange('favorites')}
                  className="ui-btn ui-btn-secondary rounded-xl px-4 py-2.5 text-sm"
                >
                  去收藏夹
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="space-y-3 sm:space-y-4"
        >
      {/* 游玩历史 */}
      {tab === 'history' && (
        <>
          {dataLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : sortedHistory.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <svg className="w-16 h-16 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-base">这里还没开场，先去挑个世界吧。</p>
              <Link href="/explore" className="ui-btn ui-btn-primary mt-4 rounded-lg px-6 py-2 text-sm">
                去探索
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {historyGroups.map((group) => (
                <section key={group.key} className="space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${historyStatusStyles[group.key] || 'bg-gray-100 text-gray-600'}`}>
                      {group.title}
                    </span>
                    <span className="text-xs text-gray-400">{group.sessions.length} 条</span>
                  </div>
                  <div className="space-y-3">
                    {group.sessions.map((session) => {
                      const isActive = session.status === 'active';

                      return (
                        <div key={session.id} className="ui-panel p-4 sm:p-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-base font-semibold text-gray-900">{session.worldTitle}</p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                <span className={`rounded-full px-2.5 py-1 font-medium ${historyStatusStyles[session.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {session.progress}
                                </span>
                                {session.genre && (
                                  <span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-600">
                                    {SITE_CONFIG.genres.find((genre) => genre.key === session.genre)?.name || session.genre}
                                  </span>
                                )}
                                {session.protagonist_name && (
                                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                                    主角 {session.protagonist_name}
                                  </span>
                                )}
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-500">
                                  最近游玩 {session.lastPlayed}
                                </span>
                              </div>
                            </div>

                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                              <button
                                type="button"
                                onClick={() => router.push(`/play/${session.id}`)}
                                className={isActive
                                  ? 'ui-btn ui-btn-primary rounded-xl px-4 py-2.5 text-sm'
                                  : 'ui-btn ui-btn-secondary rounded-xl px-4 py-2.5 text-sm'
                                }
                              >
                                {isActive ? '继续游玩' : '回顾故事'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteSession(session.id)}
                                disabled={deletingSessionId === session.id}
                                className="ui-btn ui-btn-danger rounded-xl px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingSessionId === session.id ? '删除中...' : '删除记录'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {/* 我的收藏 */}
      {tab === 'favorites' && (
        <>
          {dataLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-52 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <svg className="w-16 h-16 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              <p className="text-base">收藏夹还空着，逛到喜欢的就先收下。</p>
              <Link href="/explore" className="ui-btn ui-btn-primary mt-4 rounded-lg px-6 py-2 text-sm">
                去探索
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {favorites.map((world) => (
                  <WorldCard key={world.id} world={world} isAuthenticated={Boolean(user)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 成就 */}
      {tab === 'achievements' && (
        <>
          {dataLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : achievements.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <span className="text-5xl mb-4">🏆</span>
              <p className="text-base text-gray-600">成就墙还没亮起来</p>
              <p className="mt-1 text-sm text-gray-400">多玩几段、多逛一逛，它就会慢慢亮。</p>
              <Link href="/explore" className="ui-btn ui-btn-primary mt-4 rounded-lg px-6 py-2 text-sm">
                去探索
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-brand/10 bg-brand/5 px-4 py-4">
                  <p className="text-xs text-brand/70">已点亮</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{unlockedAchievements}</p>
                  <p className="mt-1 text-xs text-gray-500">共 {achievements.length} 个成就</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                  <p className="text-xs text-amber-700">最近亮起</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">{latestUnlockedAchievement?.name || '下一枚成就在等你'}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {latestUnlockedAchievement?.unlocked_at
                      ? new Date(latestUnlockedAchievement.unlocked_at).toLocaleDateString('zh-CN')
                      : '继续游玩、收藏或创作，都可能触发新的成就。'}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-white px-4 py-4">
                  <p className="text-xs text-gray-400">还没亮</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{remainingAchievementCount}</p>
                  <p className="mt-1 text-xs text-gray-500">慢慢点，一格格都会亮起来。</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {achievements.map((ach) => (
                  <div
                    key={ach.id}
                    className={`rounded-xl border p-4 transition-all ${
                      ach.unlocked
                        ? 'bg-white border-brand/20 shadow-sm'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-3xl ${ach.unlocked ? '' : 'grayscale opacity-70'}`}>
                        {ach.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{ach.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${ach.unlocked ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}>
                            {ach.unlocked ? '已点亮' : '未点亮'}
                          </span>
                          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-600">
                            {ACHIEVEMENT_CATEGORY_LABELS[ach.category] || ach.category}
                          </span>
                        </div>
                        <p className={`mt-1 text-sm leading-6 ${ach.unlocked ? 'text-gray-600' : 'text-gray-500'}`}>
                          {ach.description || '继续游玩、收藏或创作后再回来看看。'}
                        </p>
                        <p className="mt-2 text-xs text-gray-400">
                          {ach.unlocked && ach.unlocked_at
                            ? `解锁时间：${new Date(ach.unlocked_at).toLocaleDateString('zh-CN')}`
                            : '解锁后会在这里显示日期，方便你回看自己的里程碑。'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* 设置 */}
      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
            <div className="ui-panel p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">常用入口</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">继续、补给、会员</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">常用的几个入口放一起，省得来回翻。</p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Link href="/recharge" className="ui-btn ui-btn-primary rounded-xl px-4 py-3 text-sm">
                    去补积分
                  </Link>
                  <Link href="/membership" className="ui-btn ui-btn-secondary rounded-xl px-4 py-3 text-sm">
                    看看会员
                  </Link>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {settingsSummaryItems.map((item) => (
                  <div key={item.label} className="rounded-[1.45rem] border border-gray-100 bg-gray-50/80 px-4 py-4">
                    <p className="text-xs text-gray-400">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{item.value}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{item.note}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-gray-100 bg-gray-50/80 px-4 py-4">
                <p className="text-xs font-medium text-gray-400">现在最适合点哪儿</p>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{continueLabel}</p>
                    <p className="mt-1 break-words text-sm text-gray-600">{continueHint}</p>
                    <p className="mt-2 text-xs leading-5 text-gray-500">{balanceSummary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(continueHref)}
                    className="ui-btn ui-btn-soft rounded-xl px-4 py-2.5 text-sm"
                  >
                    {continueActionLabel}
                  </button>
                </div>
              </div>
            </div>

            <div className="ui-panel p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">积分小账本</p>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">最近动静</h3>
                  <p className="mt-2 text-sm leading-6 text-gray-500">先看最近几条，够用就不展开。</p>
                </div>
                {hasMoreCreditLogs ? (
                  <button
                    type="button"
                    onClick={() => setShowAllCredits((prev) => !prev)}
                    className="ui-btn ui-btn-secondary rounded-xl px-4 py-2.5 text-sm"
                  >
                    {showAllCredits ? '收起' : `展开全部 ${credits.length} 条`}
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-2">
                {dataLoading ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="h-12 animate-pulse rounded-xl bg-gray-100" />
                  ))
                ) : visibleCreditLogs.length === 0 ? (
                  <div className="rounded-2xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
                    还没有积分记录
                  </div>
                ) : (
                  visibleCreditLogs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-3 rounded-[1.35rem] border border-gray-100 bg-gray-50/80 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm text-gray-700">{log.desc}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          {log.date}
                          {log.balanceAfter != null ? ` · 余额 ${log.balanceAfter}` : ''}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-semibold ${log.amount > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {log.amount > 0 ? '+' : ''}{log.amount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div className="ui-panel p-5">
              <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">把这里弄得更像你</p>
              <h3 className="mt-2 text-lg font-semibold text-gray-900">昵称和简介</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">头像在上面改，这里写点关于你。</p>

              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <div className="rounded-[1.5rem] bg-gray-50 px-4 py-4">
                  <p className="text-xs font-medium text-gray-500">昵称</p>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(truncateText(e.target.value, SITE_CONFIG.limits.auth.nicknameMaxLength))}
                    onKeyDown={(e) => {
                      if (!editingNickname || e.nativeEvent.isComposing) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleSaveNickname();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelNicknameEdit();
                      }
                    }}
                    disabled={!editingNickname || nicknameSubmitting}
                    maxLength={SITE_CONFIG.limits.auth.nicknameMaxLength * 2}
                    className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-all focus:border-brand disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                    <span>{editingNickname ? '回车保存，Esc 取消。' : '评论、创作里都会用这个名字。'}</span>
                    <span>{getTextLength(nickname)}/{SITE_CONFIG.limits.auth.nicknameMaxLength}</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    {editingNickname ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { void handleSaveNickname(); }}
                          disabled={nicknameSubmitting}
                          className="ui-btn ui-btn-primary rounded-xl px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {nicknameSubmitting ? '保存中...' : '存一下昵称'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelNicknameEdit}
                          disabled={nicknameSubmitting}
                          className="ui-btn ui-btn-secondary rounded-xl px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingNickname(true)}
                        className="ui-btn ui-btn-secondary rounded-xl px-4 py-3 text-sm"
                      >
                        改昵称
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-gray-50 px-4 py-4">
                  <p className="text-xs font-medium text-gray-500">个人简介</p>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(truncateText(e.target.value, PROFILE_BIO_MAX_LENGTH))}
                    onKeyDown={(e) => {
                      if (!editingBio || e.nativeEvent.isComposing) return;
                      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                        e.preventDefault();
                        void handleSaveBio();
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelBioEdit();
                      }
                    }}
                    disabled={!editingBio || bioSubmitting}
                    rows={7}
                    placeholder="比如：爱慢热线，也爱一点疯感。"
                    className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition-all focus:border-brand disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-400">
                    <span>{editingBio ? 'Ctrl / ⌘ + Enter 保存，Esc 取消。' : '留一句话，让这里更像你。'}</span>
                    <span>{getTextLength(bio)}/{PROFILE_BIO_MAX_LENGTH}</span>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    {editingBio ? (
                      <>
                        <button
                          type="button"
                          onClick={() => { void handleSaveBio(); }}
                          disabled={bioSubmitting}
                          className="ui-btn ui-btn-primary rounded-xl px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {bioSubmitting ? '保存中...' : '存一下简介'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelBioEdit}
                          disabled={bioSubmitting}
                          className="ui-btn ui-btn-secondary rounded-xl px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingBio(true)}
                        className="ui-btn ui-btn-secondary rounded-xl px-4 py-3 text-sm"
                      >
                        改简介
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="ui-panel p-5">
              <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">账号安全</p>
              <h3 className="mt-2 text-lg font-semibold text-gray-900">密码和登录</h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">跟登录有关的，都放在这儿。</p>

              <div className="mt-4 space-y-3">
                <input
                  type="password"
                  placeholder="当前密码"
                  value={pwForm.old}
                  onChange={(e) => setPwForm({ ...pwForm, old: e.target.value })}
                  maxLength={SITE_CONFIG.limits.auth.passwordMaxLength}
                  disabled={pwSubmitting}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-all focus:border-brand disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
                <input
                  type="password"
                  placeholder={`新密码（至少 ${SITE_CONFIG.limits.auth.passwordMinLength} 位）`}
                  value={pwForm.new}
                  onChange={(e) => setPwForm({ ...pwForm, new: e.target.value })}
                  maxLength={SITE_CONFIG.limits.auth.passwordMaxLength}
                  disabled={pwSubmitting}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-all focus:border-brand disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
                <input
                  type="password"
                  placeholder="确认新密码"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  maxLength={SITE_CONFIG.limits.auth.passwordMaxLength}
                  disabled={pwSubmitting}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-all focus:border-brand disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                />
                {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                {pwSuccess && <p className="text-xs text-emerald-500">{pwSuccess}</p>}
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={pwSubmitting}
                  className="ui-btn ui-btn-primary rounded-xl px-4 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pwSubmitting ? '提交中...' : '换密码'}
                </button>
              </div>

              <div className="mt-5 border-t border-gray-100 pt-5">
                <p className="text-xs font-medium text-gray-400">退出 / 注销</p>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={logout}
                    className="ui-btn ui-btn-secondary rounded-xl px-4 py-3 text-sm"
                  >
                    退出登录
                  </button>
                  {!deleteConfirm && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(true)}
                      className="ui-btn ui-btn-danger rounded-xl px-4 py-3 text-sm"
                    >
                      注销账号
                    </button>
                  )}
                </div>

                {deleteConfirm && (
                  <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-4">
                    <p className="text-sm font-semibold text-red-600">确认注销账号</p>
                    <p className="mt-1 text-xs leading-5 text-red-500">这一步不能撤回，数据会一起清掉。输入密码再确认。</p>
                    <input
                      type="password"
                      placeholder="输入密码确认注销"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      disabled={deleteSubmitting}
                      className="mt-3 w-full rounded-xl border border-red-200 px-4 py-3 text-sm outline-none transition-all focus:border-red-400 disabled:cursor-not-allowed disabled:bg-red-100/60"
                    />
                    {deleteError && <p className="mt-2 text-xs text-red-500">{deleteError}</p>}
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleDeleteAccount}
                        disabled={deleteSubmitting}
                        className="ui-btn ui-btn-danger rounded-xl px-4 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {deleteSubmitting ? '注销中...' : '确认注销'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
                        className="ui-btn ui-btn-secondary rounded-xl px-4 py-3 text-sm"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
        </m.div>
      </AnimatePresence>
    </div>
  );
}
