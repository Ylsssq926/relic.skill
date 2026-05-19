'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { m, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { SITE_CONFIG } from '@/config/site';
import { STATUS_COPY } from '@/config/copy';
import { CharacterModal, type CharacterProfile } from '@/components/CharacterModal';
import { emitWorldStatsUpdated, isApiErrorStatus, worldsAPI, playAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { trapFocus } from '@/lib/a11y';
import { copyText, formatCount, getDisplayInitial, getTextLength, truncateText } from '@/lib/utils';
import { toast } from '@/lib/toast';

/* ── Config ────────────────────────────────────────────── */

const GENRE_GRADIENTS = SITE_CONFIG.genreGradients;

const DIFFICULTY_MAP: Record<string, { text: string; color: string }> = {
  easy: { text: '简单', color: 'bg-green-100 text-green-700' },
  normal: { text: '普通', color: 'bg-yellow-100 text-yellow-700' },
  hard: { text: '困难', color: 'bg-red-100 text-red-700' },
};

const CHARACTER_INTERACTION_PLAY_TYPES = new Set(['romance', 'role_play', 'companion']);
const WORLD_LIMITS = SITE_CONFIG.limits.world;
const RATING_VALUES = Array.from(
  { length: WORLD_LIMITS.ratingMax - WORLD_LIMITS.ratingMin + 1 },
  (_, index) => WORLD_LIMITS.ratingMin + index,
);

const ProtagonistCreator = dynamic(
  () => import('@/components/ProtagonistCreator').then((mod) => mod.ProtagonistCreator),
);

const COLLAPSIBLE_TEXT_PREVIEW_LENGTH = SITE_CONFIG.ui.worldDetailPreviewLength;

function getTextValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseWorldTags(value: unknown): string[] {
  const normalizeTags = (items: unknown[]): string[] => Array.from(
    new Set(
      items
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  );

  if (Array.isArray(value)) return normalizeTags(value);
  if (typeof value !== 'string') return [];

  const raw = value.trim();
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return normalizeTags(parsed);
    if (typeof parsed === 'string') {
      return normalizeTags(parsed.split(/[，,]/));
    }
  } catch {
    // Ignore JSON parse failure and fall back to comma-separated parsing.
  }

  return normalizeTags(raw.split(/[，,]/));
}

type WorldHighlight = {
  icon: string;
  title: string;
  description: string;
};

const WORLD_DIFFICULTY_COPY: Record<string, string> = {
  easy: '轻松一点，好进场',
  normal: '节奏顺，边走边选',
  hard: '每一步都算数',
};

function normalizeInlineText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function shortenText(text: string, maxLength: number): string {
  const normalized = normalizeInlineText(text);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function getOpeningHook(opening: string): string {
  const firstLine = opening.split(/\n+/).map((line) => line.trim()).find(Boolean) || opening;
  const firstSentence = firstLine.split(/[。！？!?]/).map((segment) => segment.trim()).find(Boolean) || firstLine;
  return shortenText(firstSentence, 18);
}

function getSectionPreviewText(content: string, maxLength = 58): string {
  const normalized = normalizeInlineText(content);
  if (!normalized) return '';
  const firstSentence = normalized.split(/[。！？!?]/).map((segment) => segment.trim()).find(Boolean) || normalized;
  return shortenText(firstSentence, maxLength);
}

function getCharacterCardKey(character: CharacterProfile): string {
  if (character.id != null) return `character-${String(character.id)}`;

  const sortOrder = typeof character.sort_order === 'number' ? String(character.sort_order) : 'na';
  const name = getTextValue(character.name) || 'unnamed';
  const role = getTextValue(character.role) || 'npc';
  const greeting = getTextValue(character.greeting) || 'no-greeting';
  const appearance = getTextValue(character.appearance) || 'no-appearance';
  const background = getTextValue(character.background) || 'no-background';

  return `character-${sortOrder}-${name}-${role}-${greeting}-${appearance}-${background}`;
}

function normalizeStartErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return '故事入口刚刚没推开，请稍后再试';
  if (/AI|模型|服务|500|503/i.test(message)) return '现在还叫不醒讲故事的人，稍后再来推门试试。';
  if (/网络已断开|网络连接失败/.test(message)) return '网络断开了，门还没法打开；连上以后再试一次。';
  if (/超时/.test(message)) return '刚刚敲门有点久没回应，再试一次就好。';
  return message;
}

function buildWorldHighlights({
  playType,
  playModeLabel,
  genre,
  characters,
  opening,
  difficultyKey,
  narrativeMode,
}: {
  playType?: { name: string; icon: string; desc?: string };
  playModeLabel: string;
  genre?: { name: string; icon: string };
  characters: CharacterProfile[];
  opening: string;
  difficultyKey: string;
  narrativeMode?: { name: string; desc?: string };
}): WorldHighlight[] {
  const playStyleText = [genre?.name, playModeLabel].filter(Boolean).join(' · ') || '沉浸式互动';
  const playStyleDesc = playType?.desc
    ? shortenText(playType.desc, 18)
    : genre
      ? `主打${genre.name}氛围，一开场就有代入感`
      : '上手就能进入剧情状态';

  const mainCompanions = characters.filter((char) => Boolean(char.is_main_companion));
  const playableCharacters = characters.filter((char) => Boolean(char.is_playable));
  const namedCharacters = characters.map((char) => getTextValue(char.name)).filter(Boolean);

  let characterDesc = '';
  if (mainCompanions.length > 0) {
    const names = mainCompanions.map((char) => getTextValue(char.name)).filter(Boolean);
    const leadNames = names.slice(0, 2).join('、');
    characterDesc = leadNames
      ? `重点和${leadNames}${mainCompanions.length > 2 ? '等人' : ''}拉关系，互动浓度很高`
      : '主打和核心角色的高浓度互动';
  } else if (playableCharacters.length > 0) {
    const names = playableCharacters.map((char) => getTextValue(char.name)).filter(Boolean);
    const leadName = names[0];
    characterDesc = leadName
      ? `可以直接代入${leadName}${playableCharacters.length > 1 ? '等角色' : ''}`
      : '可以直接带身份进场';
  } else if (namedCharacters.length > 0) {
    const leadNames = namedCharacters.slice(0, 2).join('、');
    characterDesc = namedCharacters.length === 1
      ? `围绕${leadNames}展开关键剧情，角色存在感很强`
      : `和${leadNames}${namedCharacters.length > 2 ? '等人' : ''}不断碰撞出新剧情`;
  } else if (narrativeMode?.desc) {
    characterDesc = shortenText(narrativeMode.desc, 22);
  } else {
    characterDesc = '角色与剧情绑定推进，代入感在线';
  }

  const openingHook = getOpeningHook(opening);
  const difficultyLabel = DIFFICULTY_MAP[difficultyKey]?.text || DIFFICULTY_MAP.normal.text;
  const paceDesc = openingHook
    ? `开场就落在「${openingHook}」${difficultyKey === 'hard' ? '，别眨眼' : difficultyKey === 'easy' ? '，很好接' : '，节奏刚好'}`
    : `${difficultyLabel}难度，${WORLD_DIFFICULTY_COPY[difficultyKey] || WORLD_DIFFICULTY_COPY.normal}`;

  return [
    {
      icon: playType?.icon || genre?.icon || '🎮',
      title: '这口气',
      description: `${playStyleText}，${playStyleDesc}`,
    },
    {
      icon: mainCompanions.length > 0 ? '🤝' : playableCharacters.length > 0 ? '🎭' : '👥',
      title: '先遇见谁',
      description: characterDesc,
    },
    {
      icon: openingHook ? '🔥' : '⚡',
      title: '开场在哪',
      description: paceDesc,
    },
  ];
}

function CollapsibleTextSection({
  title,
  content,
  hint,
  mobileTitleOnly = false,
}: {
  title: string;
  content: string;
  hint?: string;
  mobileTitleOnly?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const previewText = getSectionPreviewText(content, mobileTitleOnly ? 52 : 72);
  const shouldCollapse = mobileTitleOnly || content.length > COLLAPSIBLE_TEXT_PREVIEW_LENGTH;
  const displayText = !isExpanded && shouldCollapse ? (previewText || content) : content;
  const buttonLabel = isExpanded ? '收起' : '展开';

  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-gray-100 bg-white shadow-sm shadow-slate-100/70">
      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {hint && (
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {hint}
              </p>
            )}
          </div>
          {shouldCollapse && (
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="shrink-0 rounded-full bg-brand/5 px-3 py-1 text-xs font-medium text-brand ring-1 ring-brand/10 transition-colors hover:bg-brand/10 cursor-pointer"
            >
              {buttonLabel}
            </button>
          )}
        </div>

        <div className="mt-4 rounded-[1.35rem] border border-gray-100 bg-gray-50/80 px-4 py-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
            {displayText}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── Page Component ────────────────────────────────────── */

export default function WorldDetailPage() {
  const params = useParams();
  const worldId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterProfile | null>(null);
  const [preferredStartCharacterId, setPreferredStartCharacterId] = useState<string | number | null>(null);
  const [preferredInteractionTarget, setPreferredInteractionTarget] = useState('');
  const [world, setWorld] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [comments, setComments] = useState<Record<string, unknown>[]>([]);
  const [commentsError, setCommentsError] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [startError, setStartError] = useState('');
  const [rating, setRating] = useState<{ average: number | null; count: number; userScore: number | null }>({ average: null, count: 0, userScore: null });
  const [ratingError, setRatingError] = useState(false);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetail, setReportDetail] = useState('');
  const reportDialogRef = useRef<HTMLDivElement>(null);
  const reportCloseButtonRef = useRef<HTMLButtonElement>(null);
  const reportPreviousFocusRef = useRef<HTMLElement | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [loadTick, setLoadTick] = useState(0);
  const mountedRef = useRef(true);
  const restoredActionKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!startError) return;
    const timer = window.setTimeout(() => setStartError(''), 4500);
    return () => window.clearTimeout(timer);
  }, [startError]);

  useEffect(() => {
    setShowAllComments(false);
  }, [worldId]);

  const handleBackNavigation = useCallback(() => {
    if (typeof window === 'undefined') {
      router.push('/explore');
      return;
    }

    const hasSameOriginReferrer = (() => {
      try {
        return Boolean(document.referrer && new URL(document.referrer).origin === window.location.origin);
      } catch {
        return false;
      }
    })();

    if (hasSameOriginReferrer && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/explore');
  }, [router]);

  useEffect(() => {
    if (world && typeof world.title === 'string') {
      document.title = `${world.title} | 入戏`;
    }
  }, [world]);

  const fetchComments = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await worldsAPI.getComments(worldId, signal ? { signal } : undefined);
      if (signal?.aborted || !mountedRef.current) return;
      setComments(data.data?.comments || data.comments || []);
      setCommentsError(false);
    } catch {
      if (signal?.aborted || !mountedRef.current) return;
      setCommentsError(true);
    }
  }, [worldId]);

  const fetchRating = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await worldsAPI.getRating(worldId, signal ? { signal } : undefined);
      if (signal?.aborted || !mountedRef.current) return;
      const r = data.data || data;
      setRating({ average: r.average, count: r.count, userScore: r.userScore });
      setRatingError(false);
    } catch {
      if (signal?.aborted || !mountedRef.current) return;
      setRatingError(true);
    }
  }, [worldId]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadWorld() {
      setLoading(true);
      setError('');
      setNotFound(false);
      setComments([]);
      setCommentsError(false);
      setRating({ average: null, count: 0, userScore: null });
      setRatingError(false);
      try {
        const resp = await worldsAPI.get(worldId, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const worldData = (resp.data || resp) as Record<string, unknown>;
        const resolvedWorld = ((worldData.world as Record<string, unknown> | undefined) || worldData) as Record<string, unknown>;
        setWorld(resolvedWorld);
        setLiked(Boolean(worldData.is_favorited || (resolvedWorld.is_favorited as boolean | undefined)));
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const errMsg = err instanceof Error ? err.message : '';
        if (isApiErrorStatus(err, 404)) {
          setNotFound(true);
        } else {
          setError(errMsg || '这扇门一时没打开');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadWorld();
    void fetchComments(controller.signal);
    void fetchRating(controller.signal);
    return () => {
      controller.abort();
    };
  }, [worldId, loadTick, fetchComments, fetchRating]);

  const closeReportModal = useCallback(() => {
    setReportOpen(false);
    setReportReason('');
    setReportDetail('');
  }, []);

  useEffect(() => {
    if (!reportOpen) return;

    reportPreviousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      reportCloseButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeReportModal();
        return;
      }

      trapFocus(reportDialogRef.current, event);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      reportPreviousFocusRef.current?.focus();
    };
  }, [reportOpen, closeReportModal]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">正在替你推开这扇门...</p>
        </div>
      </div>
    );
  }

  if (notFound || (!world && !error)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">🌍</p>
          <h1 className="text-xl font-bold text-gray-900">这扇门现在推不开</h1>
          <p className="mt-2 text-sm text-gray-500">它可能已经被收起，或者还没正式对外开放。</p>
          <Link href="/" className="ui-btn ui-btn-primary mt-4 rounded-lg px-6 py-2 text-sm">
            回首页再挑一扇门
          </Link>
        </div>
      </div>
    );
  }

  if (error && !world) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-6xl mb-4">😔</p>
          <h1 className="text-xl font-bold text-gray-900">这扇门一时没打开</h1>
          <p className="mt-2 text-sm text-gray-500">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError('');
              setNotFound(false);
              setLoading(true);
              setLoadTick((t) => t + 1);
            }}
            className="ui-btn ui-btn-secondary mt-2 rounded-lg px-4 py-2 text-sm"
          >
            重试
          </button>
          <Link href="/" className="ui-btn ui-btn-primary mt-4 rounded-lg px-6 py-2 text-sm">
            回首页再挑一扇门
          </Link>
        </div>
      </div>
    );
  }

  if (!world) return null;

  const genre = SITE_CONFIG.genres.find((g) => g.key === (world.genre as string));
  const gradient = GENRE_GRADIENTS[(world.genre as string)] || 'from-gray-500 to-gray-400';
  const playTypeKey = ((world.playType as string) || (world.play_type as string) || 'world');
  const playType = SITE_CONFIG.playTypes.find((item) => item.key === playTypeKey);
  const isCharacterInteraction = CHARACTER_INTERACTION_PLAY_TYPES.has(playTypeKey);
  const playModeLabel = isCharacterInteraction ? '角色互动' : '世界冒险';
  const playTypeHeroLabel = playType?.name || playModeLabel;
  const narrativeMode = SITE_CONFIG.narrativeModes.find((m) => m.key === ((world.narrativeMode as string) || (world.narrative_mode as string)));
  const difficultyKey = typeof world.difficulty === 'string' ? world.difficulty : 'normal';
  const difficulty = DIFFICULTY_MAP[difficultyKey] || DIFFICULTY_MAP.normal;
  const worldStatus = typeof world.status === 'string' ? world.status : 'published';
  const isCreatorView = !!user && Number(user.id) === Number(world.creator_id);
  const isWorldPublic = worldStatus === 'published' && Number(world.is_public) === 1;
  const startButtonLabel = isCreatorView && !isWorldPublic
    ? '进入预览'
    : user
      ? '开始入戏'
      : '登录后开始';
  const startAccessBadge = isCreatorView && !isWorldPublic ? '只你能看' : user ? '现在就能进' : '登录后能进';
  const startButtonClass = isCharacterInteraction ? 'ui-btn-primary-character' : 'ui-btn-primary-adventure';
  const visibilityHint = worldStatus === 'draft' ? '这是你的草稿，先只给你自己看。' : '这扇门还没公开，现在只有你能进。';
  const cameFromShare = searchParams.get('from') === 'share';
  const worldPath = `/world/${params.id}`;
  const worldEntryPath = cameFromShare ? `${worldPath}?from=share` : worldPath;
  const buildWorldActionRedirectPath = (
    action: 'start' | 'report' | 'favorite' | 'rate',
    extraParams?: Record<string, string | number | null | undefined>,
  ) => {
    const nextParams = new URLSearchParams();
    if (cameFromShare) nextParams.set('from', 'share');
    nextParams.set('action', action);

    if (extraParams) {
      Object.entries(extraParams).forEach(([key, value]) => {
        if (value == null) return;
        const normalizedValue = String(value).trim();
        if (!normalizedValue) return;
        nextParams.set(key, normalizedValue);
      });
    }

    return `${worldPath}?${nextParams.toString()}`;
  };
  const startRedirectPath = buildWorldActionRedirectPath('start');
  const reportRedirectPath = buildWorldActionRedirectPath('report');
  const favoriteRedirectPath = buildWorldActionRedirectPath('favorite');
  const worldCharacters = Array.isArray(world.characters) ? (world.characters as CharacterProfile[]) : [];
  const hasCharacters = worldCharacters.length > 0;
  const worldTitle = getTextValue(world.title) || '未命名世界';
  const defaultProtagonistName = typeof user?.nickname === 'string' ? user.nickname.trim() : '';
  const descriptionText = getTextValue(world.description);
  const settingText = getTextValue(world.setting);
  const rulesText = getTextValue(world.rules);
  const openingText = getTextValue(world.opening);
  const coverUrl = getTextValue(world.cover_url);
  const worldTags = parseWorldTags(world.tags);
  const openingHook = getOpeningHook(openingText);
  const worldPlayCountRaw = Number((world.playCount as number) ?? (world.play_count as number) ?? 0);
  const worldPlayCount = Number.isFinite(worldPlayCountRaw) ? worldPlayCountRaw : 0;
  const worldLikeCountRaw = Number((world.likeCount as number) ?? (world.like_count as number) ?? 0);
  const worldLikeCount = Number.isFinite(worldLikeCountRaw) ? worldLikeCountRaw : 0;
  const mainCompanions = worldCharacters.filter((char) => Boolean(char.is_main_companion));
  const playableCharacters = worldCharacters.filter((char) => Boolean(char.is_playable));
  const primaryInteractionCharacters = mainCompanions.length > 0 ? mainCompanions : worldCharacters;
  const highlightedCharacterNames = primaryInteractionCharacters
    .map((char) => getTextValue(char.name))
    .filter(Boolean)
    .slice(0, 2);
  const interactionLeadNames = primaryInteractionCharacters
    .map((char) => getTextValue(char.name))
    .filter(Boolean)
    .slice(0, 3);
  const primaryInteractionName = interactionLeadNames[0] || '';
  const highlightedCharacterLine = highlightedCharacterNames.join('、');
  const primaryInteractionCharacter = primaryInteractionCharacters[0];
  const primaryInteractionGreeting = getTextValue(primaryInteractionCharacter?.greeting);
  const primaryInteractionPersonality = getTextValue(primaryInteractionCharacter?.personality);
  const creatorInteractionTargetLabel = preferredInteractionTarget || (isCharacterInteraction && playTypeKey !== 'role_play' ? primaryInteractionName : '');
  const startMomentLine = openingHook
    ? `就从「${openingHook}」接进去`
    : highlightedCharacterLine
      ? `先去见 ${highlightedCharacterLine}`
      : '一进去就是第一幕';
  const worldHighlights = buildWorldHighlights({
    playType,
    playModeLabel,
    genre,
    characters: worldCharacters,
    opening: openingText,
    difficultyKey,
    narrativeMode,
  });
  const shareFlowLead = cameFromShare
    ? user
      ? `这条分享只是别人走到这儿的一线。想的话，就从这里开你的版本。`
      : `这条分享只是别人走到这儿的一线。想开你的版本，先登录；回来还在这儿。`
    : '';
  const characterStartFlowLead = isCharacterInteraction
    ? playTypeKey === 'role_play'
      ? '开场前先挑身份。'
      : primaryInteractionName
        ? `开场前先定个名字，再去见 ${primaryInteractionName}。`
        : '开场前先定个名字。'
    : '';
  const startSocialProofLine = [
    worldPlayCount > 0 ? `${formatCount(worldPlayCount)} 次开局` : '',
    worldLikeCount > 0 ? `${formatCount(worldLikeCount)} 人收藏` : '',
    rating.average != null ? `${rating.average.toFixed(1)} 分口碑` : '',
  ].filter(Boolean).join(' · ');
  const heroImpactLine = cameFromShare
    ? '别人递来的是一段，不是终点。门还在你这边。'
    : isCharacterInteraction
      ? primaryInteractionName
        ? `${primaryInteractionName} 已经站在第一句那边等你。`
        : '门后先到的，是一句正经对话。'
      : openingHook
        ? `门一开，就落在「${openingHook}」。`
        : '门一开，直接进第一幕。';
  const heroImmersionPoints = [
    openingHook ? `开场就是「${openingHook}」` : '开场不绕弯',
    isCharacterInteraction
      ? primaryInteractionName
        ? `很快会见到 ${primaryInteractionName}`
        : '很快会见到关键角色'
      : highlightedCharacterLine
        ? `先遇见 ${highlightedCharacterLine}`
        : '关键人物很快上场',
    user
      ? (isCharacterInteraction ? '定个称呼就能接' : '定个名字就能进')
      : '登录后回来还在这里',
  ].filter(Boolean).slice(0, 3);
  const startQuickSteps = [
    {
      title: user
        ? playTypeKey === 'role_play'
          ? '先选代入身份'
          : isCharacterInteraction
            ? '先确认你的名字 / 身份'
            : '先给主角定个名字'
        : '先登录 / 注册',
      description: user
        ? playTypeKey === 'role_play'
          ? '不用离开当前页，选好后就能直接进场。'
          : '补一句名字或设定就行，不用先写长文。'
        : '点开始后会自动回到这里，刚才看的内容都不会丢。',
    },
    {
      title: openingHook ? `接住「${openingHook}」` : primaryInteractionName ? `先遇见 ${primaryInteractionName}` : '直接踏进第一幕',
      description: isCharacterInteraction
        ? primaryInteractionName
          ? `很快就会和 ${primaryInteractionName} 对上第一句。`
          : '剧情会很快把你送到角色面前。'
        : '不是继续看设定，而是让剧情立刻动起来。',
    },
  ] as const;
  const mobileStartHint = user
    ? cameFromShare
      ? `分享里的只是其中一条线 · ${openingHook ? `从「${openingHook}」开你的版本` : '从同一个世界重开'}`
      : isCharacterInteraction
        ? playTypeKey === 'role_play'
          ? '先挑身份，再进场'
          : defaultProtagonistName
            ? `会先带上「${defaultProtagonistName}」，点头就能去见 TA`
            : '先定个名字，再去见 TA'
        : `${openingHook ? `从「${openingHook}」直接开场` : defaultProtagonistName ? `会先带上「${defaultProtagonistName}」，点头就能进` : '先定个名字，再进场'}`
    : cameFromShare
      ? '分享里的只是其中一条线 · 先登录，回来还在这儿'
      : '先登录，回来就能接着进';
  const startSellingPoints = [
    cameFromShare ? '从分享页直接接上' : openingHook ? `从「${openingHook}」接进第一幕` : '先看清设定再决定',
    '开场预览不扣额度',
    user ? (isCharacterInteraction ? '确认主角后开始角色互动' : '确认主角后开始世界冒险') : '登录后自动回到这里',
    isCharacterInteraction
      ? playTypeKey === 'role_play'
        ? (playableCharacters.length > 0 ? `可代入 ${playableCharacters.length} 位角色` : '先选代入身份')
        : '更适合用自己身份进入'
      : highlightedCharacterLine ? `你会遇见 ${highlightedCharacterLine}` : worldCharacters.length > 0 ? `${worldCharacters.length} 位角色已就位` : '',
  ].filter(Boolean).slice(0, 3);
  const mobileHeroImpactSummary = shortenText(heroImpactLine, 40);
  const mobileHeroPillPoints = startSellingPoints.slice(0, 2);
  const mobileHeroSubtitle = shortenText(
    (isCharacterInteraction && (primaryInteractionGreeting || primaryInteractionPersonality)
      ? [primaryInteractionName && `先遇见 ${primaryInteractionName}`, primaryInteractionGreeting || primaryInteractionPersonality].filter(Boolean).join(' · ')
      : descriptionText || openingText || settingText || shareFlowLead || `${playModeLabel} · ${genre?.name || '沉浸式互动'}`),
    72,
  );
  const mobileHeroMeta = [
    worldPlayCount > 0 ? `${formatCount(worldPlayCount)} 次开局` : '',
    rating.average != null ? `${rating.average.toFixed(1)} 分口碑` : '',
    worldLikeCount > 0 ? `${formatCount(worldLikeCount)} 收藏` : '',
  ].filter(Boolean).slice(0, 2);
  const heroEntrySummary = isCharacterInteraction
    ? primaryInteractionName
      ? `点开始后，很快就会和 ${primaryInteractionName} 对上第一句。`
      : '点开始后，很快就会进第一轮互动。'
    : openingHook
      ? `点开始后，就从「${openingHook}」接上。`
      : '点开始后，直接进第一幕。';
  const featuredCharacters = primaryInteractionCharacters.slice(0, 3);
  const startButtonSubline = openingHook
    ? cameFromShare
      ? `从「${openingHook}」开始你的版本`
      : `从「${openingHook}」直接进场`
    : user
      ? cameFromShare
        ? '定一下名字，就能开始你的版本'
        : '定一下名字，就能进场'
      : cameFromShare
        ? '先登录，回来就能开始'
        : '先登录，回来就能进场';
  const mobileDockHint = cameFromShare
    ? '别人那条线只是前情，下一步才轮到你'
    : openingHook
      ? `再推一步，就落在「${openingHook}」`
      : isCharacterInteraction
        ? '再推一步，就轮到那句真对话'
        : '再推一步，门后就是第一幕';
  const heroEntryTitle = cameFromShare
    ? '从这里，开你的版本'
    : isCharacterInteraction
      ? playTypeKey === 'role_play'
        ? '挑好身份，直接进'
        : primaryInteractionName
          ? `先去见 ${primaryInteractionName}`
          : '从第一轮对话开始'
      : openingHook
        ? `从「${openingHook}」开始`
        : '从第一幕开始';
  const heroEntryCopy = cameFromShare
    ? '别人递给你的，只是已经走到这儿的一线。真正轮到你的，是从这里再长一条。'
    : isCharacterInteraction
      ? playTypeKey === 'role_play'
        ? '挑好身份，故事就直接把你送进去。'
        : primaryInteractionName
          ? `定好名字后，${primaryInteractionName} 很快就会把第一句递过来。`
          : '定好名字后，很快就会进第一轮互动。'
      : openingHook
        ? `点开始以后，就从「${openingHook}」接上。`
        : '点开始以后，直接进第一幕。';
  const heroEntryPoints = heroImmersionPoints.slice(0, 3);
  const doorHookSourceText = isCharacterInteraction
    ? primaryInteractionGreeting || primaryInteractionPersonality || openingText || descriptionText || settingText
    : openingText || descriptionText || settingText || rulesText;
  const doorHookText = doorHookSourceText
    ? shortenText(normalizeInlineText(doorHookSourceText), isCharacterInteraction ? 92 : 100)
    : isCharacterInteraction
      ? '先听 TA 这一句，再决定要不要往前。'
      : '先看开场这一口气，再决定进不进。';
  const doorHookLabel = isCharacterInteraction
    ? primaryInteractionGreeting
      ? `${primaryInteractionName || 'TA'} 多半先这么开口`
      : primaryInteractionName
        ? `你会先被 ${primaryInteractionName} 拉近`
        : '你会先被这一句拉近'
    : openingText
      ? '门一开，先到你面前的是这一幕'
      : '先看这一口气';
  const doorHookSupport = isCharacterInteraction
    ? (heroEntrySummary || characterStartFlowLead || '先看这一句，再决定要不要继续靠近。')
    : (openingHook ? `真正开始时，故事会从「${openingHook}」直接接上。` : heroEntrySummary);
  const doorHookDisplayText = isCharacterInteraction && primaryInteractionGreeting
    ? `“${doorHookText.replace(/^“|”$/g, '')}”`
    : doorHookText;
  const creatorName = ((world.creator as Record<string, unknown>)?.nickname as string) || (world.creator_name as string) || '匿名';
  const worldDateLabel = world.created_at
    ? new Date(world.created_at as string).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }) + (isWorldPublic ? '发布' : '创建')
    : '';
  const heroMetaLine = [creatorName, worldDateLabel].filter(Boolean).join(' · ');
  const worldQuickFacts = [
    {
      label: isCharacterInteraction ? '先遇见谁' : '第一幕入口',
      value: isCharacterInteraction
        ? (highlightedCharacterLine || primaryInteractionName || '开始后剧情会先把关键角色送到你面前')
        : (openingHook ? `从「${openingHook}」这一幕开始` : '一进场就直接踏进第一幕'),
    },
    {
      label: '玩法',
      value: playType ? `${playType.icon} ${playTypeHeroLabel}` : playModeLabel,
    },
    narrativeMode ? { label: '叙事', value: narrativeMode.name } : null,
    {
      label: '难度',
      value: `${difficulty.text} · ${WORLD_DIFFICULTY_COPY[difficultyKey] || WORLD_DIFFICULTY_COPY.normal}`,
    },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const worldStatsChips = [
    worldPlayCount > 0 ? `游玩 ${formatCount(worldPlayCount)} 次` : '',
    worldLikeCount > 0 ? `收藏 ${formatCount(worldLikeCount)} 次` : '',
    rating.average != null
      ? `评分 ${rating.average}${rating.count > 0 ? ` (${rating.count})` : ''}`
      : ratingError
        ? '评分加载失败'
        : '暂无评分',
  ].filter(Boolean);
  const detailMetaChips = [
    playType ? `玩法 · ${playType.icon} ${playType.key === 'world' ? '世界冒险' : playType.name}` : '',
    narrativeMode ? `叙事 · ${narrativeMode.name}` : '',
    `难度 · ${difficulty.text}`,
    ...worldTags.map((tag) => `#${tag}`),
    !isWorldPublic ? (worldStatus === 'draft' ? '草稿预览' : '未公开') : '',
  ].filter(Boolean).slice(0, 10);
  const mobileContentChips = [...worldStatsChips, ...detailMetaChips].slice(0, 4);
  const noCharacterSectionTitle = isCharacterInteraction
    ? '人还没全站到光里'
    : '这世界的人还没全露脸';
  const noCharacterSectionDescription = isCharacterInteraction
    ? '这会儿先不给你整张角色卡。真进场时，第一位要紧的人会自己走到你面前。'
    : '这会儿先不给你整排角色卡。真进场时，关键人物会自己上场。';
  const noCharacterSectionSteps = [
    {
      title: isCharacterInteraction ? '先给自己定个名字' : '先给主角定个名字',
      description: isCharacterInteraction
        ? '写一个名字就能进场，不用等角色卡补齐。'
        : '写一个主角名字就能进场，不会因为这里空着而停住。',
    },
    {
      title: isCharacterInteraction ? '直接撞上第一轮互动' : '直接踏进第一幕',
      description: isCharacterInteraction
        ? '开场会很快把第一位要紧的人送到你面前。'
        : '剧情会直接把关键人物带上场，不会只让你停在设定页。',
    },
  ] as const;
  const characterSectionLead = isCharacterInteraction
    ? highlightedCharacterLine
      ? `先点开 ${highlightedCharacterLine} 里最对你胃口的那个，听听 TA 第一声怎么来。`
      : '先点开最让你好奇的那个，听听 TA 第一声怎么来。'
    : highlightedCharacterLine
      ? `这些人会把戏抬起来。先挑一个最想先遇见的。`
      : '先挑一个最想先遇见的，看看 TA 会怎么出场。';
  const selectedCharacterName = typeof selectedCharacter?.name === 'string' ? selectedCharacter.name.trim() : '';
  const characterActionLabel = selectedCharacterName ? '选择 TA' : '开始入戏';
  const visibleComments = showAllComments ? comments : comments.slice(0, 3);
  const hasMoreComments = comments.length > 3;
  const reportDetailLength = getTextLength(reportDetail);
  const commentTextLength = getTextLength(commentText);
  const renderCoverPoster = (className = '', sizes = '(max-width: 640px) 34vw, 220px') => {
    if (!coverUrl) return null;

    return (
      <div className={`relative aspect-[3/4] overflow-hidden rounded-[1.6rem] border border-white/16 bg-white/10 shadow-[0_26px_72px_-34px_rgba(15,23,42,0.78)] ${className}`}>
        <Image
          src={coverUrl}
          alt={`${worldTitle} 海报`}
          fill
          sizes={sizes}
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/28 via-transparent to-white/8" />
      </div>
    );
  };

  const buildStartActionRedirectPath = (character?: CharacterProfile | null) => {
    const targetName = character ? getTextValue(character.name) : '';

    return buildWorldActionRedirectPath('start', {
      character_id: Boolean(character?.is_playable) && character?.id != null ? String(character.id) : null,
      target: targetName || null,
    });
  };

  const handleStartAdventure = (character?: CharacterProfile | null) => {
    const targetName = character ? getTextValue(character.name) : '';
    setStartError('');
    setPreferredInteractionTarget(targetName || (isCharacterInteraction && playTypeKey !== 'role_play' ? primaryInteractionName : ''));
    setPreferredStartCharacterId(character && Boolean(character.is_playable) ? (character.id ?? null) : null);

    if (!user) {
      router.push(`/auth?redirect=${encodeURIComponent(buildStartActionRedirectPath(character))}`);
      return;
    }

    setShowCreator(true);
  };

  const handleConfirmProtagonist = async (name: string, description: string, characterId?: string | number) => {
    setStartError('');
    try {
      const resp = await playAPI.start(Number(world.id), name, description, startRedirectPath, characterId);
      const data = (resp.data || resp) as { session?: { id?: number }; session_id?: number; id?: number };
      const sessionId = data.session?.id || data.session_id || data.id;
      if (!sessionId) throw new Error('无法获取会话 ID');
      router.push(`/play/${sessionId}`);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setStartError(normalizeStartErrorMessage(err));
    }
  };

  const handleFavoriteChange = async (nextLiked: boolean) => {
    if (!world.id || !user || favoritePending || liked === nextLiked) return;

    const prevLiked = liked;
    const delta = nextLiked ? 1 : -1;

    setFavoritePending(true);
    setLiked(nextLiked);
    setWorld((prev) => {
      if (!prev) return prev;
      const current = (prev.likeCount as number) ?? (prev.like_count as number) ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, like_count: next, likeCount: next };
    });

    try {
      const data = await worldsAPI.toggleFavorite(world.id as string | number, nextLiked);
      if (!mountedRef.current) return;
      const result = (data.data || data) as Record<string, unknown>;
      const confirmedLiked = typeof result.favorited === 'boolean'
        ? result.favorited
        : typeof result.is_favorited === 'boolean'
          ? result.is_favorited
          : typeof result.isFavorited === 'boolean'
            ? result.isFavorited
            : nextLiked;
      const rawConfirmedLikeCount = typeof result.like_count === 'number'
        ? result.like_count
        : typeof result.likeCount === 'number'
          ? result.likeCount
          : null;
      const confirmedLikeCount = rawConfirmedLikeCount !== null ? Math.max(0, rawConfirmedLikeCount) : null;

      setLiked(confirmedLiked);
      if (confirmedLikeCount !== null) {
        setWorld((prev) => (prev ? { ...prev, like_count: confirmedLikeCount, likeCount: confirmedLikeCount } : prev));
      }

      emitWorldStatsUpdated({
        id: String(world.id),
        likeCount: confirmedLikeCount ?? undefined,
        isFavorited: confirmedLiked,
      });

      if (confirmedLiked) {
        toast.success('先替你收好了');
      } else {
        toast.info('已经放回去了');
      }
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setLiked(prevLiked);
      setWorld((prev) => {
        if (!prev) return prev;
        const current = (prev.likeCount as number) ?? (prev.like_count as number) ?? 0;
        const reverted = Math.max(0, current - delta);
        return { ...prev, like_count: reverted, likeCount: reverted };
      });
      toast.error(err instanceof Error ? err.message : (nextLiked ? '没收住，再试一次' : '取消没收住，再试一次'));
    } finally {
      if (mountedRef.current) setFavoritePending(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      router.push(`/auth?redirect=${encodeURIComponent(favoriteRedirectPath)}`);
      return;
    }

    await handleFavoriteChange(!liked);
  };

  const handleShare = async () => {
    const canNativeShare = typeof navigator.share === 'function';

    try {
      if (canNativeShare) {
        await navigator.share({ title: (world.title as string) || '入戏', url: window.location.href });
        return;
      }

      const copied = await copyText(window.location.href);
      if (copied) {
        toast.success('链接已经给你了');
        return;
      }

      toast.error('复制失败，请手动复制链接');
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      toast.error(canNativeShare ? '分享失败，请重试' : '复制失败，请手动复制链接');
    }
  };

  const handleAddComment = async () => {
    const content = commentText.trim();
    if (!content) return;
    if (getTextLength(content) > WORLD_LIMITS.commentMaxLength) {
      toast.error(`评论不能超过${WORLD_LIMITS.commentMaxLength}字`);
      return;
    }
    setCommentLoading(true);
    try {
      await worldsAPI.addComment(params.id as string, content);
      if (!mountedRef.current) return;
      setCommentText('');
      await fetchComments();
      if (!mountedRef.current) return;
      toast.success('评论成功');
    } catch {
      if (!mountedRef.current) return;
      toast.error('评论失败，请重试');
    } finally {
      if (mountedRef.current) setCommentLoading(false);
    }
  };

  const handleRate = async (score: number) => {
    if (!user) {
      router.push(`/auth?redirect=${encodeURIComponent(buildWorldActionRedirectPath('rate', { score }))}`);
      return;
    }
    if (ratingSubmitting) return;

    setRatingSubmitting(true);
    try {
      const data = await worldsAPI.rate(params.id as string, score);
      if (!mountedRef.current) return;
      const r = data.data || data;
      setRating({ average: r.average, count: r.count, userScore: score });
      setRatingError(false);
      emitWorldStatsUpdated({
        id: String(params.id),
        avgRating: r.average,
        ratingCount: r.count,
      });
      toast.success(`评分成功，已打 ${score} 分`);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      toast.error(err instanceof Error ? err.message : '评分失败，请重试');
    } finally {
      if (mountedRef.current) setRatingSubmitting(false);
    }
  };

  const handleOpenReport = () => {
    if (!user) {
      router.push(`/auth?redirect=${encodeURIComponent(reportRedirectPath)}`);
      return;
    }
    setReportOpen(true);
  };

  const handleReport = async () => {
    if (!user) {
      router.push(`/auth?redirect=${encodeURIComponent(reportRedirectPath)}`);
      return;
    }
    if (!reportReason) return;
    setReportSubmitting(true);
    try {
      await worldsAPI.report(params.id as string, reportReason, reportDetail, reportRedirectPath);
      if (!mountedRef.current) return;
      closeReportModal();
      toast.success('举报已提交，感谢反馈');
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      toast.error(err instanceof Error ? err.message : '这条反馈还没送到');
    } finally {
      if (mountedRef.current) setReportSubmitting(false);
    }
  };

  // 登录回跳后恢复用户动作
  useEffect(() => {
    const action = searchParams.get('action');

    if (!user || !action) {
      restoredActionKeyRef.current = null;
      return;
    }

    const restoredScoreParam = searchParams.get('score') || '';
    const restoredCharacterId = searchParams.get('character_id') || '';
    const restoredTarget = searchParams.get('target') || '';
    const restoreKey = [action, restoredScoreParam, restoredCharacterId, restoredTarget].join('|');

    if (restoredActionKeyRef.current === restoreKey) return;
    if ((action === 'start' || action === 'favorite') && !world) return;

    const clearRestoredActionParams = () => {
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('action');
      newParams.delete('character_id');
      newParams.delete('target');
      newParams.delete('score');
      const qs = newParams.toString();
      router.replace(`/world/${params.id}${qs ? `?${qs}` : ''}`, { scroll: false });
    };

    if (action === 'rate') {
      const restoredScore = Number(restoredScoreParam);
      const isInvalidScore = !Number.isInteger(restoredScore)
        || restoredScore < WORLD_LIMITS.ratingMin
        || restoredScore > WORLD_LIMITS.ratingMax;

      if (isInvalidScore) {
        restoredActionKeyRef.current = restoreKey;
        clearRestoredActionParams();
        return;
      }
    }

    restoredActionKeyRef.current = restoreKey;

    if (action === 'start') {
      const playableCharacterIds = Array.isArray(world?.characters)
        ? new Set(
            (world.characters as CharacterProfile[])
              .filter((character) => Boolean(character.is_playable) && character.id != null)
              .map((character) => String(character.id)),
          )
        : new Set<string>();
      const restoredPlayableCharacterId = restoredCharacterId && playableCharacterIds.has(restoredCharacterId)
        ? restoredCharacterId
        : null;

      setPreferredStartCharacterId(restoredPlayableCharacterId);
      setPreferredInteractionTarget(restoredTarget);
      setShowCreator(true);
      clearRestoredActionParams();
      return;
    }

    if (action === 'report') {
      setReportOpen(true);
      clearRestoredActionParams();
      return;
    }

    if (action === 'favorite') {
      void handleFavoriteChange(true);
      clearRestoredActionParams();
      return;
    }

    if (action === 'rate') {
      void handleRate(Number(restoredScoreParam));
      clearRestoredActionParams();
    }
  }, [user, searchParams, params.id, router, world, handleRate, handleFavoriteChange]);

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-32 sm:pb-72 lg:pb-12">
        {/* ── Cover ──────────────────────────────────── */}
        <div className={`relative min-h-[70svh] overflow-hidden bg-gradient-to-br sm:min-h-[32rem] lg:min-h-[38rem] ${gradient}`}>
          {coverUrl ? (
            <>
              <Image
                src={coverUrl}
                alt={`${worldTitle} 封面`}
                fill
                priority
                sizes="100vw"
                className="object-cover scale-105 saturate-110"
                unoptimized
              />
              <div className="absolute inset-0 bg-black/18 sm:bg-black/12" />
            </>
          ) : (
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -left-12 top-12 h-48 w-48 rounded-full bg-white/12 blur-3xl" />
              <div className="absolute -right-12 bottom-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[7rem] opacity-25 drop-shadow-[0_20px_50px_rgba(15,23,42,0.28)] sm:text-[8rem] lg:text-[9rem]">{genre?.icon || '📖'}</span>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(255,255,255,0.16),_transparent_36%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-black/28 to-black/72 sm:from-black/8 sm:via-black/18 sm:to-gray-50" />

          {/* Back button */}
          <button
            onClick={handleBackNavigation}
            className="absolute left-4 top-[calc(1rem+env(safe-area-inset-top))] z-20 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-black/25 px-3 py-2 text-sm text-white backdrop-blur-sm transition-colors hover:bg-black/35 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            返回
          </button>

          <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-6 sm:hidden">
            <div className="rounded-[30px] border border-white/12 bg-black/35 p-4 text-white shadow-[0_26px_60px_-30px_rgba(15,23,42,0.7)] backdrop-blur-md">
              {genre && (
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm"
                  style={{ backgroundColor: `${genre.color}cc` }}
                >
                  {genre.icon} {genre.name}
                </span>
              )}
              <div className="mt-3 flex items-start gap-3">
                {renderCoverPoster('w-[5.4rem] shrink-0 rounded-[1.2rem]', '86px')}
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-white/72">{heroEntryTitle}</p>
                  <h1 className="mt-2 text-[1.9rem] font-bold leading-tight text-white [text-shadow:0_8px_32px_rgba(0,0,0,0.35)]">{worldTitle}</h1>
                  <p className="mt-2 text-sm font-medium leading-6 text-white/90">{mobileHeroImpactSummary}</p>
                  {heroMetaLine ? <p className="mt-3 text-[11px] leading-5 text-white/70">{heroMetaLine}</p> : null}
                  {mobileHeroMeta.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/82">
                      {mobileHeroMeta.map((item) => (
                        <span key={item} className="rounded-full border border-white/12 bg-white/10 px-2.5 py-1">
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-white/66">{doorHookLabel}</p>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm italic leading-6 text-white/92">
                  {doorHookDisplayText}
                </p>
              </div>
              {mobileHeroPillPoints.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/82">
                  {mobileHeroPillPoints.map((item) => (
                    <span key={item} className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                      {item}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="mt-4 text-[11px] leading-5 text-white/72">{mobileStartHint}</p>
            </div>
          </div>


          <div className="absolute inset-x-0 bottom-0 z-10 hidden sm:block">
            <div className="mx-auto w-full max-w-[96rem] px-6 pb-14 lg:px-8 lg:pb-20 xl:px-10">
              <div className="grid gap-5 rounded-[2.2rem] border border-white/15 bg-black/20 p-6 text-white shadow-[0_26px_80px_-32px_rgba(15,23,42,0.6)] backdrop-blur-md lg:grid-cols-[minmax(0,1.22fr)_minmax(18rem,0.78fr)] lg:p-7">
                <div className="max-w-3xl">
                  {genre && (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20"
                      style={{ backgroundColor: `${genre.color}cc` }}
                    >
                      {genre.icon} {genre.name}
                    </span>
                  )}
                  <h1 className="mt-5 text-4xl font-black tracking-tight text-white lg:text-5xl">{worldTitle}</h1>
                  <p className="mt-4 max-w-2xl text-xl font-semibold leading-9 text-white/94">{heroImpactLine}</p>
                  {heroMetaLine ? <p className="mt-4 text-sm text-white/72">{heroMetaLine}</p> : null}
                  {worldStatsChips.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/82">
                      {worldStatsChips.slice(0, 3).map((chip) => (
                        <span key={chip} className="rounded-full border border-white/12 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                          {chip}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-[1.9rem] border border-white/12 bg-black/28 p-5 shadow-[0_22px_56px_-32px_rgba(15,23,42,0.75)]">
                  {renderCoverPoster('mx-auto mb-4 w-32 rounded-[1.35rem]', '128px')}
                  <p className="text-[11px] font-semibold tracking-[0.18em] text-white/68">{doorHookLabel}</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[15px] italic leading-7 text-white/92">
                    {doorHookDisplayText}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-white/78">{shareFlowLead || characterStartFlowLead || startMomentLine}</p>
                  <button
                    type="button"
                    onClick={() => handleStartAdventure()}
                    className={`ui-btn mt-5 w-full rounded-[22px] px-5 py-3.5 text-sm text-white shadow-[0_18px_40px_-26px_rgba(15,23,42,0.55)] ${startButtonClass}`}
                  >
                    {startButtonLabel}
                  </button>
                  <p className="mt-2 text-xs leading-5 text-white/68">{startButtonSubline}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 hidden h-32 bg-gradient-to-t from-gray-50 via-gray-50/82 to-transparent sm:block" />
        </div>

        {/* ── Main Card ──────────────────────────────── */}
        <div className="relative z-10 mx-auto -mt-16 w-full max-w-[96rem] px-4 sm:-mt-20 sm:px-6 lg:-mt-24 xl:px-8">
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="ui-panel overflow-hidden"
          >
            <div className="px-4 py-5 sm:px-8 sm:py-8">
              {isCreatorView && !isWorldPublic && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {visibilityHint} 你可以先自己游玩验证，发布后才会出现在探索页。
                </div>
              )}

              <div className="mt-5 space-y-4">
                <div className="rounded-[1.8rem] border border-gray-100 bg-gray-50/80 px-4 py-4 sm:px-5 sm:py-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 max-w-2xl">
                      <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">一眼先看清</p>
                      <h2 className="mt-2 text-lg font-semibold text-gray-900">这扇门里是什么、怎么开始</h2>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{heroEntryCopy}</p>
                    </div>
                    <div className="min-w-0 lg:max-w-xl">
                      {heroMetaLine ? <p className="text-xs leading-5 text-gray-500">{heroMetaLine}</p> : null}
                      {detailMetaChips.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {detailMetaChips.slice(0, 6).map((chip) => (
                            <span key={chip} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {worldStatsChips.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {worldStatsChips.slice(0, 3).map((chip) => (
                            <span key={chip} className="rounded-full border border-brand/10 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand">
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {worldHighlights.map((item) => (
                    <div key={item.title} className="rounded-[1.55rem] border border-gray-100 bg-white px-4 py-4 shadow-sm shadow-slate-100/60">
                      <p className="text-[1.35rem]">{item.icon}</p>
                      <h3 className="mt-2 text-sm font-semibold text-gray-900">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_minmax(18rem,0.88fr)] xl:items-start">
                <div className="space-y-4">
                  {descriptionText && descriptionText !== doorHookSourceText && (
                    <div className="hidden rounded-[1.9rem] border border-gray-100 bg-white px-5 py-5 shadow-sm sm:block">
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-gray-700">
                        {descriptionText}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    {openingText && (
                      <CollapsibleTextSection
                        title="先看开场"
                        content={openingText}
                      />
                    )}
                    {settingText && <CollapsibleTextSection title="这地方大概" content={settingText} mobileTitleOnly />}
                    {rulesText && <CollapsibleTextSection title="这地方的规矩" content={rulesText} mobileTitleOnly />}
                  </div>
                </div>

                <div className="hidden space-y-4 lg:block xl:sticky xl:top-24">
                  <div className="ui-panel-brand overflow-hidden">
                    <div className="px-4 py-4 sm:px-5 sm:py-5">
                      <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">进场前先知道</p>
                      <p className="mt-2 text-sm leading-6 text-gray-600">{shareFlowLead || characterStartFlowLead || startMomentLine}</p>
                      <div className="mt-4 space-y-3">
                        {heroEntryPoints.map((point) => (
                          <div key={point} className="rounded-[1.2rem] border border-brand/10 bg-white/82 px-3.5 py-3">
                            <p className="text-sm leading-6 text-gray-700">{point}</p>
                          </div>
                        ))}
                      </div>
                      {startSocialProofLine && (
                        <p className="mt-4 text-xs font-medium text-gray-500">{startSocialProofLine}</p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex gap-3">
                      <button
                        onClick={handleToggleFavorite}
                        disabled={favoritePending}
                        aria-label={liked ? '取消收藏' : '收藏此世界'}
                        className={`flex-1 rounded-2xl border-2 px-4 py-3 text-sm font-medium transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                          liked
                            ? 'ui-btn ui-btn-danger rounded-2xl px-4 py-3 text-sm'
                            : 'ui-btn ui-btn-secondary rounded-2xl px-4 py-3 text-sm'
                        }`}
                      >
                        {favoritePending ? '等等...' : `${liked ? '❤️' : '🤍'} 先收着`}
                      </button>
                      <button
                        onClick={handleShare}
                        aria-label="分享此世界"
                        className="ui-btn ui-btn-secondary flex-1 rounded-2xl px-4 py-3 text-sm"
                      >
                        📤 递给朋友
                      </button>
                    </div>
                    {worldStatsChips.length > 0 && (
                      <p className="mt-3 text-xs leading-5 text-gray-500">{worldStatsChips.slice(0, 3).join(' · ')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </m.div>

          {/* ── Characters Section ────────────────────── */}
          {hasCharacters ? (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="ui-panel mt-6 overflow-hidden"
            >
              <div className="px-4 py-5 sm:px-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{isCharacterInteraction ? '先认识要和你对上戏的人' : '先认认会把戏抬起来的人'}</h2>
                    <p className="mt-1 text-sm text-gray-500">{characterSectionLead}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3 sm:hidden">
                  {worldCharacters.map((char) => {
                    const charName = ((typeof char.name === 'string' ? char.name : '') || '').trim() || '未命名角色';
                    const isPlayable = Boolean(char.is_playable);
                    const isMainCompanion = Boolean(char.is_main_companion);
                    const personality = ((typeof char.personality === 'string' ? char.personality : '') || '').trim() || '这份性子还没写满';
                    const background = ((typeof char.background === 'string' ? char.background : '') || '').trim() || '这段来历还没完全写下';
                    const appearance = ((typeof char.appearance === 'string' ? char.appearance : '') || '').trim() || '外貌还留着一点想象空间';
                    const greeting = ((typeof char.greeting === 'string' ? char.greeting : '') || '').trim() || 'TA 还没留下第一句话';
                    const avatarUrl = ((typeof char.avatar_url === 'string' ? char.avatar_url : '') || '').trim();
                    const firstImpression = appearance !== '外貌还留着一点想象空间' ? appearance : personality;
                    const previewLine = greeting === 'TA 还没留下第一句话'
                      ? firstImpression
                      : `“${greeting}”`;
                    const secondaryLine = isPlayable
                      ? `想直接上身时，就从 ${charName} 进去。`
                      : isMainCompanion
                        ? `${charName} 多半会是你最先撞上的人。`
                        : background !== '这段来历还没完全写下'
                          ? background
                          : `先看看 ${charName} 会怎么走进你的视线。`;

                    return (
                      <button
                        key={`mobile-${getCharacterCardKey(char)}`}
                        type="button"
                        onClick={() => setSelectedCharacter(char)}
                        className="w-full rounded-[24px] border border-gray-100 bg-white p-3 text-left shadow-sm transition-colors hover:border-brand/30"
                      >
                        <div className="flex items-start gap-3">
                          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[18px] bg-gradient-to-br from-brand/25 via-brand-light/20 to-brand-dark/45">
                            {avatarUrl ? (
                              <Image
                                src={avatarUrl}
                                alt={charName}
                                fill
                                sizes="96px"
                                className="object-cover object-top"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-3xl font-black text-white/90">
                                {getDisplayInitial(charName, '角')}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-base font-semibold text-gray-900">{charName}</p>
                              {isPlayable && (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-medium text-emerald-600">可代入</span>
                              )}
                              {!isPlayable && isMainCompanion && (
                                <span className="rounded-full bg-brand/10 px-2.5 py-1 text-[10px] font-medium text-brand">主互动</span>
                              )}
                            </div>
                            <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm italic leading-6 text-gray-900">{previewLine}</p>
                            <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs leading-5 text-gray-500">{secondaryLine}</p>
                            <span className="mt-3 inline-flex rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand">
                              先看看
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 hidden grid-cols-1 gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {worldCharacters.map((char) => {
                    const charName = ((typeof char.name === 'string' ? char.name : '') || '').trim() || '未命名角色';
                    const isPlayable = Boolean(char.is_playable);
                    const isMainCompanion = Boolean(char.is_main_companion);
                    const personality = ((typeof char.personality === 'string' ? char.personality : '') || '').trim() || '这份性子还没写满';
                    const background = ((typeof char.background === 'string' ? char.background : '') || '').trim() || '这段来历还没完全写下';
                    const appearance = ((typeof char.appearance === 'string' ? char.appearance : '') || '').trim() || '外貌还留着一点想象空间';
                    const greeting = ((typeof char.greeting === 'string' ? char.greeting : '') || '').trim() || 'TA 还没留下第一句话';
                    const avatarUrl = ((typeof char.avatar_url === 'string' ? char.avatar_url : '') || '').trim();
                    const firstImpression = appearance !== '外貌还留着一点想象空间' ? appearance : personality;
                    const previewLine = greeting === 'TA 还没留下第一句话'
                      ? firstImpression
                      : `“${greeting}”`;
                    const secondaryLine = isPlayable
                      ? `想直接上身时，就从 ${charName} 进去。`
                      : isMainCompanion
                        ? `${charName} 多半会是你最先撞上的人。`
                        : background !== '这段来历还没完全写下'
                          ? background
                          : `先看看 ${charName} 会怎么走进你的视线。`;

                    return (
                      <m.button
                        key={getCharacterCardKey(char)}
                        type="button"
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelectedCharacter(char)}
                        className="group w-full cursor-pointer rounded-[24px] border border-gray-100 bg-gradient-to-br from-white via-white to-brand/5 p-3 text-left shadow-sm transition-all hover:border-brand/30 hover:shadow-[0_22px_48px_-26px_rgba(59,130,196,0.45)]"
                      >
                        <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] bg-gradient-to-br from-brand/25 via-brand-light/20 to-brand-dark/45">
                          {avatarUrl ? (
                            <Image
                              src={avatarUrl}
                              alt={charName}
                              fill
                              sizes="(max-width: 1024px) 80vw, 33vw"
                              className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-5xl font-black text-white/90">
                              {getDisplayInitial(charName, '角')}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/82 via-slate-950/18 to-transparent" />
                          <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-2">
                            {isPlayable && (
                              <span className="shrink-0 rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm">
                                可代入
                              </span>
                            )}
                            {!isPlayable && isMainCompanion && (
                              <span className="shrink-0 rounded-full bg-white/16 px-2.5 py-1 text-[10px] font-medium text-white ring-1 ring-white/15 backdrop-blur-sm">
                                主互动
                              </span>
                            )}
                          </div>
                          <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/75">
                              {isPlayable ? '也能直接上身' : isCharacterInteraction ? '先认这一眼' : '会把戏抬起来'}
                            </p>
                            <h3 className="mt-1 break-words text-2xl font-black tracking-tight drop-shadow-sm">{charName}</h3>
                            <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/82">
                              {firstImpression}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 px-1">
                          <p className="line-clamp-2 whitespace-pre-wrap break-words text-[15px] italic leading-7 text-gray-900">
                            {previewLine}
                          </p>
                          <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-500">
                            {secondaryLine}
                          </p>
                          <span className="mt-3 inline-flex rounded-full bg-brand/10 px-3 py-1 text-[11px] font-semibold text-brand">
                            先看看
                          </span>
                        </div>
                      </m.button>
                    );
                  })}
                </div>
              </div>
            </m.div>
          ) : (
            <m.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="ui-panel mt-6 overflow-hidden"
            >
              <div className="px-6 py-5 sm:px-8">
                <div className="ui-panel-brand p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-xl text-brand">
                      👥
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{noCharacterSectionTitle}</h2>
                      <p className="mt-1 text-sm leading-6 text-gray-600">{noCharacterSectionDescription}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {noCharacterSectionSteps.map((step) => (
                      <div key={step.title} className="rounded-[1.2rem] border border-brand/10 bg-white/80 px-4 py-3">
                        <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                        <p className="mt-2 text-sm leading-6 text-gray-600">{step.description}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    <p className="text-gray-500">不用等角色卡补齐，也能从主入口直接进场。</p>
                    <Link
                      href="/explore"
                      className="font-medium text-brand transition-colors hover:text-brand-dark"
                    >
                      先看看别的 →
                    </Link>
                  </div>
                </div>
              </div>
            </m.div>
          )}

          <CharacterModal
            character={selectedCharacter}
            actionLabel={characterActionLabel}
            actionClassName={startButtonClass}
            onClose={() => setSelectedCharacter(null)}
            onAction={(character) => {
              setSelectedCharacter(null);
              handleStartAdventure(character);
            }}
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          {/* ── Rating Section ────────────────────────── */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="ui-panel overflow-hidden"
          >
            <div className="px-4 py-4 sm:px-8 sm:py-5">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900 sm:text-lg">留颗星</h2>
                <button
                  onClick={handleOpenReport}
                  aria-label="举报此世界"
                  className="text-xs text-gray-400 hover:text-red-500 transition-all active:scale-[0.98] cursor-pointer"
                >
                  🚩 举报
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <div
                  className="flex items-center gap-1"
                  role="group"
                  aria-label={`为世界评分，${WORLD_LIMITS.ratingMin} 至 ${WORLD_LIMITS.ratingMax} 星`}
                >
                  {RATING_VALUES.map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRate(star)}
                      onMouseEnter={() => setHoverStar(star)}
                      onMouseLeave={() => setHoverStar(0)}
                      disabled={ratingSubmitting}
                      className="flex h-11 w-11 items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                      aria-label={`评为 ${star} 星（满分 ${WORLD_LIMITS.ratingMax} 星）`}
                    >
                      <svg
                        className={`h-6 w-6 sm:h-7 sm:w-7 ${
                          star <= (hoverStar || rating.userScore || 0)
                            ? 'text-yellow-400'
                            : 'text-gray-200'
                        } transition-colors`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </button>
                  ))}
                </div>
                <div className="text-sm text-gray-500">
                  {ratingError ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{STATUS_COPY.error.default}</span>
                      <button
                        type="button"
                        onClick={() => {
                          void fetchRating();
                        }}
                        className="font-medium text-brand transition-colors hover:text-brand-dark cursor-pointer"
                      >
                        {STATUS_COPY.retry}
                      </button>
                    </div>
                  ) : rating.average != null ? (
                    <span>{rating.average} 分 · {rating.count} 人评价</span>
                  ) : (
                    <span>这里还没亮星。要不要先点一颗？</span>
                  )}
                </div>
              </div>
              {ratingError ? null : ratingSubmitting ? (
                <p className="mt-2 text-xs text-gray-400">正在把你的这一颗星挂上去...</p>
              ) : rating.userScore ? (
                <p className="mt-2 text-xs text-brand">你已经给了它 {rating.userScore} 分；想改主意，再点一次星星就行。</p>
              ) : null}
            </div>
          </m.div>

          {/* ── Report Modal ────────────────────────── */}
          <AnimatePresence>
            {reportOpen && (
              <>
                <m.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 bg-black/40"
                  onClick={closeReportModal}
                />
                <m.div
                  ref={reportDialogRef}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="report-dialog-title"
                  className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[90vw] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.75rem] sm:border sm:border-gray-100 sm:px-6 sm:py-6 sm:shadow-[0_24px_60px_-24px_rgba(15,23,42,0.35)]"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 id="report-dialog-title" className="text-lg font-semibold text-gray-900">这儿哪里不对劲？</h3>
                    <button
                      ref={reportCloseButtonRef}
                      type="button"
                      onClick={closeReportModal}
                      className="ui-btn ui-btn-secondary h-11 w-11 rounded-full p-0 text-gray-500"
                      aria-label="关闭反馈弹窗"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'inappropriate', label: '不当内容' },
                        { key: 'plagiarism', label: '抄袭' },
                        { key: 'spam', label: '垃圾信息' },
                        { key: 'other', label: '其他' },
                      ].map((r) => (
                        <button
                          key={r.key}
                          onClick={() => setReportReason(r.key)}
                          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                            reportReason === r.key
                              ? 'bg-red-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={reportDetail}
                      onChange={(e) => setReportDetail(truncateText(e.target.value, WORLD_LIMITS.reportDetailMaxLength))}
                      placeholder="补一句你看到的情况（选填）"
                      aria-label="举报补充说明"
                      rows={3}
                      disabled={reportSubmitting}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none resize-none focus:border-red-300 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                    />
                    <p className="text-right text-xs text-gray-400">{reportDetailLength}/{WORLD_LIMITS.reportDetailMaxLength}</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={handleReport}
                        disabled={!reportReason || reportSubmitting}
                        className="ui-btn ui-btn-danger flex-1 rounded-lg py-2 text-sm disabled:opacity-50"
                      >
                        {reportSubmitting ? '送出中...' : '送出这条反馈'}
                      </button>
                      <button
                        onClick={closeReportModal}
                        className="ui-btn ui-btn-secondary rounded-lg px-4 py-2 text-sm"
                      >
                        再想想
                      </button>
                    </div>
                  </div>
                </m.div>
              </>
            )}
          </AnimatePresence>

          {/* ── Comments Section ────────────────────────── */}
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="ui-panel overflow-hidden"
          >
            <div className="px-4 py-4 sm:px-8 sm:py-5">
              <h2 className="text-base font-bold text-gray-900 sm:text-lg">门口留言 {comments.length > 0 && <span className="text-sm font-normal text-gray-400">({comments.length})</span>}</h2>

              {/* Comments List */}
              {commentsError && comments.length === 0 ? (
                <div className="mt-4 flex flex-col items-center py-8 text-gray-400">
                  <svg className="mb-3 h-12 w-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3h.008v.008H12v-.008zm8.25-.758A8.25 8.25 0 113.75 12a8.25 8.25 0 0116.5 0z" />
                  </svg>
                  <p className="text-sm">{STATUS_COPY.error.default}</p>
                  <button
                    type="button"
                    onClick={() => {
                      void fetchComments();
                    }}
                    className="mt-2 font-medium text-brand transition-colors hover:text-brand-dark cursor-pointer"
                  >
                    {STATUS_COPY.retry}
                  </button>
                </div>
              ) : comments.length === 0 ? (
                <div className="mt-4 flex flex-col items-center py-8 text-gray-400">
                  <svg className="mb-3 h-12 w-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-sm">这儿还安静着，等你留第一句</p>
                </div>
              ) : (
                <div className="mt-4 space-y-3 sm:space-y-4">
                  {visibleComments.map((c: Record<string, unknown>) => (
                    <div key={c.id as string} className="flex gap-2.5 sm:gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[11px] font-bold text-brand sm:h-8 sm:w-8 sm:text-xs">
                        {getDisplayInitial((c.nickname as string) || '匿')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="max-w-[14rem] whitespace-normal break-words text-sm font-medium text-gray-800">{(c.nickname as string) || '匿名用户'}</span>
                          <span className="text-[11px] text-gray-400 sm:text-xs">{c.created_at ? new Date(c.created_at as string).toLocaleDateString('zh-CN') : ''}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 sm:leading-relaxed">{c.content as string}</p>
                      </div>
                    </div>
                  ))}
                  {hasMoreComments && (
                    <button
                      type="button"
                      onClick={() => setShowAllComments((prev) => !prev)}
                      className="text-sm font-medium text-brand hover:underline cursor-pointer"
                    >
                      {showAllComments ? '先收起一点' : `展开全部 ${comments.length} 条留言`}
                    </button>
                  )}
                </div>
              )}

              {/* Comment Input */}
              <div className="mt-6 border-t border-gray-100 pt-4">
                {user ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(truncateText(e.target.value, WORLD_LIMITS.commentMaxLength))}
                        placeholder="写下你被哪一句击中，或提醒后来的人留意什么..."
                        aria-label="评论内容"
                        rows={2}
                        disabled={commentLoading}
                        className="w-full rounded-2xl border border-gray-200 px-3 py-2.5 text-sm outline-none resize-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                      />
                      <p className={`mt-1 text-right text-xs ${commentLoading ? 'text-brand' : 'text-gray-400'}`}>
                        {commentLoading ? '正在把这句感想贴上墙…' : `还可输入 ${WORLD_LIMITS.commentMaxLength - commentTextLength} 字`}
                      </p>
                    </div>
                    <button
                      onClick={handleAddComment}
                      disabled={commentLoading || !commentText.trim()}
                      className="ui-btn ui-btn-primary min-h-[44px] w-full rounded-2xl px-4 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                    >
                      {commentLoading ? '送出中...' : '留下这句'}
                    </button>
                  </div>
                ) : (
                  <p className="text-center text-sm text-gray-400">
                    <Link href={`/auth?redirect=${encodeURIComponent(worldEntryPath)}`} className="text-brand hover:underline">登录</Link>后就能在这儿留一句
                  </p>
                )}
              </div>
            </div>
          </m.div>
          </div>
        </div>

        {/* ── Sticky Bottom Actions (mobile) ─────────── */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/70 bg-white/92 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-14px_36px_-28px_rgba(15,23,42,0.28)] backdrop-blur-md lg:hidden">
          <div className="mx-auto flex max-w-[32rem] items-center gap-2">
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleToggleFavorite}
                disabled={favoritePending}
                className={`inline-flex min-h-[44px] w-11 items-center justify-center rounded-full border transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                  liked
                    ? 'border-red-100 bg-red-50 text-red-500'
                    : 'border-gray-200 bg-white text-gray-500'
                }`}
                aria-label={liked ? '取消收藏' : '收藏'}
              >
                {favoritePending ? (
                  <span className="text-sm leading-none">…</span>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={liked ? 0 : 1.8} aria-hidden="true">
                    <path d="M10 17.25l-1.07-.97C4.32 12.09 2 9.97 2 7.36 2 5.24 3.66 3.6 5.75 3.6c1.18 0 2.3.56 3.01 1.44A3.9 3.9 0 0111.76 3.6C13.84 3.6 15.5 5.24 15.5 7.36c0 2.61-2.32 4.73-6.93 8.92L10 17.25z" />
                  </svg>
                )}
              </button>
              <button
                onClick={handleShare}
                className="inline-flex min-h-[44px] w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:text-brand"
                aria-label="分享此世界"
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 3.75h3A1.75 1.75 0 0116 5.5v8.75A1.75 1.75 0 0114.25 16H5.5a1.75 1.75 0 01-1.75-1.75V5.5A1.75 1.75 0 015.5 3.75h3" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 12.25v-8.5" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.25 6.5L10 3.75l2.75 2.75" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => handleStartAdventure()}
              className={`ui-btn min-h-[44px] flex-1 rounded-full px-4 text-sm font-semibold text-white ${startButtonClass}`}
            >
              {startButtonLabel}
            </button>
          </div>
        </div>


      </div>

      {/* ── Protagonist Creator Modal ────────────────── */}
      {startError && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-500 px-4 py-2 text-sm text-white shadow-lg">
          {startError}
        </div>
      )}
      <AnimatePresence>
        {showCreator && (
          <ProtagonistCreator
            worldGenre={world.genre as string}
            playType={playTypeKey}
            playableCharacters={playableCharacters.map((c) => ({
              id: c.id as string | number,
              name: c.name as string,
              personality: c.personality as string | undefined,
              background: c.background as string | undefined,
              appearance: c.appearance as string | undefined,
            }))}
            interactionTargetLabel={creatorInteractionTargetLabel}
            initialCharacterId={preferredStartCharacterId ?? undefined}
            defaultName={defaultProtagonistName}
            onConfirm={handleConfirmProtagonist}
            onClose={() => setShowCreator(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
