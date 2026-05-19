'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { STATUS_COPY } from '@/config/copy';
import { SITE_CONFIG } from '@/config/site';
import { WorldCard } from '@/components/WorldCard';
import type { WorldData } from '@/components/WorldCard';
import { applyWorldStatsUpdate, WORLD_STATS_UPDATED_EVENT, type WorldStatsUpdateDetail, playAPI, userAPI, worldsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCount, normalizeWorlds, truncateText } from '@/lib/utils';

const OnboardingModal = dynamic(
  () => import('@/components/OnboardingModal').then((mod) => mod.OnboardingModal),
  { ssr: false },
);

interface RecentSessionShortcut {
  id: string;
  worldTitle: string;
  protagonistName?: string;
  status?: string;
  summary?: string;
  genre?: string;
  lastPlayed?: string;
}

const ADVENTURE_PLAY_TYPES = new Set(['world', 'dungeon']);
const CHARACTER_PLAY_TYPES = new Set(['romance', 'role_play', 'companion']);

type HomeSectionQuickPickMode = 'featured' | 'adventure' | 'character';

function getQuickPickMode(playType?: string | null): HomeSectionQuickPickMode {
  if (CHARACTER_PLAY_TYPES.has(playType || '')) return 'character';
  if (ADVENTURE_PLAY_TYPES.has(playType || '')) return 'adventure';
  return 'featured';
}

export interface HomeInitialState {
  featuredWorlds: WorldData[];
  hotWorlds: WorldData[];
  newestWorlds: WorldData[];
  hasInitialData: boolean;
}

interface HomePageProps {
  initialState: HomeInitialState;
}

function getQuickPickTeaser(world: WorldData, mode: HomeSectionQuickPickMode) {
  const opening = world.opening?.trim() || '';
  const greeting = world.primaryCharacterGreeting?.trim() || '';
  const description = world.description?.trim() || '';
  const primaryCharacterName = world.primaryCharacterName?.trim() || '';
  const fallbackText = mode === 'character'
    ? greeting || (primaryCharacterName ? `${primaryCharacterName} 正等你接话。` : description || opening)
    : opening || (primaryCharacterName ? `${primaryCharacterName} 正在等你入场。` : description || greeting);
  const maxLength = mode === 'character' ? 28 : 34;
  const truncated = truncateText(fallbackText, maxLength).trim();
  return truncated && truncated !== fallbackText ? `${truncated}…` : truncated;
}

function getWorldCharacterAvatar(world?: WorldData) {
  if (!world?.characters?.length) return '';

  const primaryName = world.primaryCharacterName?.trim() || '';
  const matchedCharacter = world.characters.find((character) => {
    const avatarUrl = character.avatarUrl?.trim() || '';
    const name = character.name?.trim() || '';
    return avatarUrl && (!primaryName || name === primaryName);
  }) || world.characters.find((character) => Boolean(character.avatarUrl?.trim()));

  return matchedCharacter?.avatarUrl?.trim() || '';
}

export default function HomePage({ initialState }: HomePageProps) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [featuredWorlds, setFeaturedWorlds] = useState<WorldData[]>(() => initialState.featuredWorlds);
  const [hotWorlds, setHotWorlds] = useState<WorldData[]>(() => initialState.hotWorlds);
  const [newest, setNewest] = useState<WorldData[]>(() => initialState.newestWorlds);
  const [loading, setLoading] = useState(() => !initialState.hasInitialData);
  const [listFetchError, setListFetchError] = useState(false);
  const [listReloadTick, setListReloadTick] = useState(0);
  const [recentSession, setRecentSession] = useState<RecentSessionShortcut | null>(null);
  const [recentHistory, setRecentHistory] = useState<RecentSessionShortcut[]>([]);
  const [favoriteWorlds, setFavoriteWorlds] = useState<WorldData[]>([]);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  const handleRetryLists = () => {
    setListFetchError(false);
    setLoading(true);
    setListReloadTick((tick) => tick + 1);
  };

  const patchWorldList = useCallback((list: WorldData[], detail: WorldStatsUpdateDetail) => {
    const nextList = list.map((item) => applyWorldStatsUpdate(item as unknown as Record<string, unknown>, detail) as unknown as WorldData);
    return nextList.some((item, index) => item !== list[index]) ? nextList : list;
  }, []);

  useEffect(() => {
    const handleWorldStatsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<WorldStatsUpdateDetail>).detail;
      if (!detail?.id) return;

      setFeaturedWorlds((prev) => patchWorldList(prev, detail));
      setHotWorlds((prev) => patchWorldList(prev, detail));
      setNewest((prev) => patchWorldList(prev, detail));
    };

    window.addEventListener(WORLD_STATS_UPDATED_EVENT, handleWorldStatsUpdated);
    return () => window.removeEventListener(WORLD_STATS_UPDATED_EVENT, handleWorldStatsUpdated);
  }, [patchWorldList]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowOnboardingModal(true);
    }, 600);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (listReloadTick === 0 && initialState.hasInitialData) {
      setListFetchError(false);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchData() {
      setLoading(true);
      try {
        const res = await worldsAPI.featured(undefined, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const data = res.data || res;
        const featuredList = Array.isArray(data.featured) ? data.featured : Array.isArray(data.worlds) ? data.worlds : [];
        const hotList = Array.isArray(data.hot) ? data.hot : [];
        const newestList = Array.isArray(data.newest) ? data.newest : [];
        setListFetchError(false);
        setFeaturedWorlds(normalizeWorlds((featuredList as Record<string, unknown>[]).slice(0, 8)));
        setHotWorlds(normalizeWorlds((hotList as Record<string, unknown>[]).slice(0, 8)));
        setNewest(normalizeWorlds((newestList as Record<string, unknown>[]).slice(0, 8)));
      } catch {
        if (!controller.signal.aborted) {
          setFeaturedWorlds([]);
          setHotWorlds([]);
          setNewest([]);
          setListFetchError(true);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      controller.abort();
    };
  }, [initialState.hasInitialData, listReloadTick]);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setRecentSession(null);
      setRecentHistory([]);
      setFavoriteWorlds([]);
      return;
    }

    const controller = new AbortController();
    setRecentSession(null);
    setRecentHistory([]);
    setFavoriteWorlds([]);

    const timer = window.setTimeout(() => {
      void (async () => {
        const requestOptions = { signal: controller.signal };
        const [activeRes, historyRes, favoritesRes] = await Promise.allSettled([
          playAPI.getSessions({ status: 'active', limit: 1 }, requestOptions),
          userAPI.getHistory({ limit: 6 }, requestOptions),
          userAPI.getFavorites({ limit: 6 }, requestOptions),
        ]);

        if (controller.signal.aborted) return;

        const activeShortcut = activeRes.status === 'fulfilled'
          ? (() => {
              const data = activeRes.value.data || activeRes.value;
              const rawSessions = Array.isArray(data.sessions) ? data.sessions : Array.isArray(data) ? data : [];
              const session = rawSessions[0] as Record<string, unknown> | undefined;
              return session
                ? {
                    id: String(session.id),
                    worldTitle: (session.world_title as string) || (session.worldTitle as string) || '未知世界',
                    protagonistName: session.protagonist_name as string | undefined,
                    status: (session.status as string) || 'active',
                    summary: session.summary as string | undefined,
                    genre: (session.genre as string) || '',
                    lastPlayed: session.updated_at ? new Date(session.updated_at as string).toLocaleDateString('zh-CN') : '',
                  }
                : null;
            })()
          : null;

        const historyShortcuts = historyRes.status === 'fulfilled'
          ? (() => {
              const data = historyRes.value.data || historyRes.value;
              const rawSessions = Array.isArray(data.sessions) ? data.sessions : Array.isArray(data) ? data : [];
              return Array.isArray(rawSessions)
                ? rawSessions.slice(0, 4).map((session) => {
                    const rawSession = session as Record<string, unknown>;
                    return {
                      id: String(rawSession.id),
                      worldTitle: (rawSession.world_title as string) || (rawSession.worldTitle as string) || '未知世界',
                      protagonistName: rawSession.protagonist_name as string | undefined,
                      status: (rawSession.status as string) || 'completed',
                      summary: rawSession.summary as string | undefined,
                      genre: (rawSession.genre as string) || '',
                      lastPlayed: rawSession.updated_at ? new Date(rawSession.updated_at as string).toLocaleDateString('zh-CN') : '',
                    };
                  })
                : [];
            })()
          : [];

        setRecentSession(activeShortcut || historyShortcuts[0] || null);
        setRecentHistory(historyShortcuts);

        if (favoritesRes.status === 'fulfilled') {
          const data = favoritesRes.value.data || favoritesRes.value;
          const rawWorlds = Array.isArray(data.worlds) ? data.worlds : Array.isArray(data) ? data : [];
          setFavoriteWorlds(normalizeWorlds(rawWorlds as Record<string, unknown>[]));
        } else {
          setFavoriteWorlds([]);
        }
      })();
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [authLoading, userId]);

  const favoriteWorldIdSet = useMemo(() => new Set(favoriteWorlds.map((world) => world.id)), [favoriteWorlds]);
  const preferredGenreWeights = useMemo(() => {
    const weights = new Map<string, number>();
    favoriteWorlds.forEach((world) => {
      if (!world.genre) return;
      weights.set(world.genre, (weights.get(world.genre) || 0) + 2);
    });
    recentHistory.forEach((session) => {
      if (!session.genre) return;
      weights.set(session.genre, (weights.get(session.genre) || 0) + 1);
    });
    return weights;
  }, [favoriteWorlds, recentHistory]);
  const preferredPlayTypeWeights = useMemo(() => {
    const weights = new Map<string, number>();
    favoriteWorlds.forEach((world) => {
      if (!world.playType) return;
      weights.set(world.playType, (weights.get(world.playType) || 0) + 2);
    });
    return weights;
  }, [favoriteWorlds]);
  const personalizedWorlds = useMemo(() => {
    if (!user || (!favoriteWorlds.length && !recentHistory.length)) return [];

    const seen = new Set<string>();
    const dedupedCandidates = [...hotWorlds, ...newest, ...featuredWorlds].filter((world) => {
      if (seen.has(world.id)) return false;
      seen.add(world.id);
      return !favoriteWorldIdSet.has(world.id);
    });

    const rankedCandidates = dedupedCandidates
      .map((world) => {
        const genreScore = world.genre ? preferredGenreWeights.get(world.genre) || 0 : 0;
        const playTypeScore = world.playType ? preferredPlayTypeWeights.get(world.playType) || 0 : 0;
        return {
          world,
          score: genreScore + playTypeScore,
        };
      })
      .sort((left, right) => right.score - left.score || right.world.playCount - left.world.playCount || right.world.likeCount - left.world.likeCount);

    const matchedWorlds = rankedCandidates.filter((item) => item.score > 0).slice(0, 5).map((item) => item.world);
    return matchedWorlds.length > 0 ? matchedWorlds : dedupedCandidates.slice(0, 5);
  }, [featuredWorlds, favoriteWorldIdSet, favoriteWorlds.length, hotWorlds, newest, preferredGenreWeights, preferredPlayTypeWeights, recentHistory.length, user]);

  const personalizedSectionTitle = recentSession ? '接着入戏' : '按你口味推荐';
  const adventureWorlds = hotWorlds.filter((w) => ADVENTURE_PLAY_TYPES.has(w.playType || 'world'));
  const characterWorlds = hotWorlds.filter((w) => CHARACTER_PLAY_TYPES.has(w.playType || 'world'));
  const featuredLeadWorld = featuredWorlds[0];
  const adventureLeadWorld = adventureWorlds[0] || featuredWorlds.find((world) => ADVENTURE_PLAY_TYPES.has(world.playType || 'world'));
  const characterLeadWorld = characterWorlds[0] || featuredWorlds.find((world) => CHARACTER_PLAY_TYPES.has(world.playType || 'world'));
  const newestLeadWorld = newest[0];
  const adventureLeadImage = adventureLeadWorld?.cover?.trim() || featuredLeadWorld?.cover?.trim() || '';
  const characterLeadImage = getWorldCharacterAvatar(characterLeadWorld) || characterLeadWorld?.cover?.trim() || getWorldCharacterAvatar(featuredLeadWorld) || '';
  const heroLeadWorld = (user ? personalizedWorlds[0] : undefined) || featuredLeadWorld || hotWorlds[0] || newestLeadWorld;
  const heroLeadMode = getQuickPickMode(heroLeadWorld?.playType);
  const heroLeadGenre = SITE_CONFIG.genres.find((genre) => genre.key === (heroLeadWorld?.genre || ''));
  const heroLeadPlayType = SITE_CONFIG.playTypes.find((playType) => playType.key === (heroLeadWorld?.playType || ''));
  const heroLeadImage = getWorldCharacterAvatar(heroLeadWorld) || heroLeadWorld?.cover?.trim() || adventureLeadImage || characterLeadImage;
  const heroLeadHref = heroLeadWorld ? `/world/${heroLeadWorld.id}` : '/explore';
  const heroLeadBadge = user ? '按你口味' : '正在上演';
  const heroLeadSummary = heroLeadWorld
    ? getQuickPickTeaser(heroLeadWorld, heroLeadMode) || truncateText(heroLeadWorld.description || '', 60)
    : '先看看这段，想进场时再打开。';
  const heroLeadMeta = heroLeadWorld
    ? [heroLeadGenre ? `${heroLeadGenre.icon} ${heroLeadGenre.name}` : '', heroLeadPlayType?.name || '互动故事'].filter(Boolean).join(' · ')
    : '正在上演';
  const heroLeadProofLine = heroLeadWorld
    ? [
        heroLeadWorld.playCount > 0 ? `${formatCount(heroLeadWorld.playCount)} 次开局` : '',
        heroLeadWorld.likeCount > 0 ? `${formatCount(heroLeadWorld.likeCount)} 人收藏` : '',
        typeof heroLeadWorld.avgRating === 'number' && Number.isFinite(heroLeadWorld.avgRating) && heroLeadWorld.avgRating > 0 ? `${heroLeadWorld.avgRating.toFixed(1)} 分口碑` : '',
      ].filter(Boolean).join(' · ')
    : '';
  const heroLeadActionLabel = heroLeadWorld ? '查看详情' : '开始探索';
  const heroPrimaryAction = { href: '/explore', label: '开始探索' };
  const heroSecondaryAction = { href: '/rankings', label: '先看看榜单' };
  const heroEntries = [
    {
      href: '/explore?board=adventure&sort=hot',
      label: '世界冒险',
      title: '挑个世界开场',
      description: '更看设定、开场和剧情走向的，从这里进场。',
      sample: adventureLeadWorld ? getQuickPickTeaser(adventureLeadWorld, 'adventure') : '',
      tone: 'brand' as const,
    },
    {
      href: '/explore?board=character&sort=hot',
      label: '角色互动',
      title: '和一个角色接上戏',
      description: '更看关系、接话感和人物张力的，从这里入戏。',
      sample: characterLeadWorld ? getQuickPickTeaser(characterLeadWorld, 'character') : '',
      tone: 'rose' as const,
    },
  ];
  const adventureShelfWorlds = (adventureWorlds.length > 0 ? adventureWorlds : hotWorlds.filter((w) => !CHARACTER_PLAY_TYPES.has(w.playType || ''))).slice(0, 3);
  const characterShelfWorlds = (characterWorlds.length > 0 ? characterWorlds : hotWorlds.filter((w) => CHARACTER_PLAY_TYPES.has(w.playType || ''))).slice(0, 3);
  const newestShelfWorlds = newest.slice(0, 3);

  const renderHeroLeadCard = (className = '') => (
    <Link
      href={heroLeadHref}
      className={`group relative block overflow-hidden rounded-[2rem] border border-white/15 bg-white/[0.08] p-5 text-left shadow-[0_36px_90px_-40px_rgba(15,23,42,0.72)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.1] sm:p-6 ${className}`}
    >
      {heroLeadImage ? (
        <>
          <Image
            src={heroLeadImage}
            alt={heroLeadWorld ? `${heroLeadWorld.title} 封面` : '首页推荐内容'}
            fill
            sizes="(max-width: 1024px) 100vw, 56vw"
            className="object-cover opacity-42 blur-[2px] transition-transform duration-700 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-br from-white/8 via-transparent to-white/4" />
        </>
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/28 to-slate-950/88" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.18),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(59,130,196,0.18),_transparent_35%)]" />
      <div className="relative flex h-full flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-end lg:gap-6">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex rounded-full border border-white/12 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/88 backdrop-blur-sm">
              {heroLeadBadge}
            </span>
            {heroLeadWorld ? (
              <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/76 backdrop-blur-sm">
                ▶ {formatCount(heroLeadWorld.playCount)}
              </span>
            ) : null}
          </div>

          <div className="mt-auto max-w-xl pt-20 sm:pt-24">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-white/58">今晚先从这段入戏</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-[2.4rem] lg:text-[2.7rem]">
              {heroLeadWorld?.title || '先从这段开始'}
            </h2>
            <p className="mt-3 max-w-xl text-[15px] font-medium leading-7 text-white/88 sm:text-base">
              {heroLeadSummary}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/66">
              <span>{heroLeadMeta}</span>
              {heroLeadProofLine ? <span className="text-white/40">·</span> : null}
              {heroLeadProofLine ? <span>{heroLeadProofLine}</span> : null}
            </div>
            <span className="mt-6 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-brand shadow-sm">
              {heroLeadActionLabel}
            </span>
          </div>
        </div>

        {heroLeadImage ? (
          <div className="hidden lg:flex lg:justify-end">
            <div className="relative aspect-[3/4] w-full max-w-[13rem] overflow-hidden rounded-[1.7rem] border border-white/16 bg-white/10 shadow-[0_30px_80px_-36px_rgba(15,23,42,0.78)]">
              <Image
                src={heroLeadImage}
                alt={heroLeadWorld ? `${heroLeadWorld.title} 海报` : '首页推荐海报'}
                fill
                sizes="208px"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/24 via-transparent to-white/8" />
            </div>
          </div>
        ) : null}
      </div>
    </Link>
  );

  const renderHeroEntryCard = (entry: (typeof heroEntries)[number]) => {
    const toneMap = {
      brand: {
        labelClass: 'text-brand-100',
        glowClass: 'from-brand/18 via-brand/8 to-transparent',
      },
      rose: {
        labelClass: 'text-rose-100',
        glowClass: 'from-rose-400/16 via-rose-400/8 to-transparent',
      },
      amber: {
        labelClass: 'text-amber-50',
        glowClass: 'from-amber-300/18 via-amber-300/8 to-transparent',
      },
    } as const;
    const tone = toneMap[entry.tone];

    return (
      <Link
        key={entry.href}
        href={entry.href}
        className="group relative min-w-0 overflow-hidden rounded-[1.65rem] border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/[0.1] sm:p-5"
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${tone.glowClass}`} />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className={`text-[11px] font-semibold tracking-[0.2em] ${tone.labelClass}`}>{entry.label}</span>
            <span className="text-sm text-white/35 transition-transform duration-300 group-hover:translate-x-0.5">↗</span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">{entry.title}</h3>
          <p className="mt-2 text-sm leading-6 text-white/78">{entry.description}</p>
          {entry.sample ? (
            <p className="mt-4 line-clamp-2 text-xs leading-5 text-white/56">
              {entry.sample}
            </p>
          ) : null}
        </div>
      </Link>
    );
  };

  const renderShelfHeader = ({
    eyebrow,
    title,
    summary,
    href,
    count,
    sortLabel,
    tone = 'brand',
    linkLabel = '看更多',
  }: {
    eyebrow: string;
    title: string;
    summary?: string;
    href: string;
    count: number;
    sortLabel?: string;
    tone?: 'brand' | 'rose' | 'amber' | 'emerald' | 'gray';
    linkLabel?: string;
  }) => {
    const toneMap = {
      brand: { eyebrowClass: 'text-brand', pillClass: 'border-brand/15 bg-brand-50 text-brand' },
      rose: { eyebrowClass: 'text-rose-500', pillClass: 'border-rose-100 bg-rose-50 text-rose-500' },
      amber: { eyebrowClass: 'text-amber-600', pillClass: 'border-amber-100 bg-amber-50 text-amber-600' },
      emerald: { eyebrowClass: 'text-emerald-600', pillClass: 'border-emerald-100 bg-emerald-50 text-emerald-600' },
      gray: { eyebrowClass: 'text-gray-500', pillClass: 'border-gray-200 bg-gray-50 text-gray-500' },
    } as const;
    const currentTone = toneMap[tone];

    return (
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-xs font-semibold tracking-[0.18em] ${currentTone.eyebrowClass}`}>{eyebrow}</p>
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
              共 {count} 条
            </span>
            {sortLabel ? (
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${currentTone.pillClass}`}>
                {sortLabel}
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-xl font-bold text-gray-900 sm:text-2xl">{title}</h2>
          {summary ? <p className="mt-1 hidden text-sm text-gray-600 sm:block">{summary}</p> : null}
        </div>
        <Link href={href} className="shrink-0 text-sm font-medium text-brand hover:underline">
          {linkLabel} →
        </Link>
      </div>
    );
  };

  const renderLaneCards = (
    items: WorldData[],
    variant: 'default' | 'adventure' | 'character' = 'default',
  ) => {
    if (items.length === 0) return null;

    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((world) => (
          <WorldCard key={world.id} world={world} variant={variant} isAuthenticated={Boolean(user)} actionLabel="查看详情" />
        ))}
      </div>
    );
  };

  return (
    <>
      {showOnboardingModal ? <OnboardingModal /> : null}

      <section className="relative overflow-hidden bg-[linear-gradient(145deg,#245a96_0%,#2f74b8_38%,#3b82c4_72%,#6ea7d6_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.2),_transparent_26%),radial-gradient(circle_at_78%_16%,_rgba(255,255,255,0.14),_transparent_18%),radial-gradient(circle_at_bottom_right,_rgba(10,23,44,0.28),_transparent_34%)]" />
        <div className="absolute -top-20 right-0 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-brand/25 blur-3xl" />

        <div className="relative mx-auto w-full max-w-[100rem] px-4 pt-24 pb-12 sm:px-6 sm:pt-28 sm:pb-14 lg:px-8 lg:pt-32 lg:pb-20 xl:px-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(23rem,1.18fr)] lg:items-center lg:gap-10 xl:gap-12">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.24em] text-white/54 sm:text-xs">
                入戏 · 掠蓝 出品
              </p>
              <div className="mt-3 max-w-3xl">
                <h1 className="text-white">
                  <span className="block text-[3.5rem] font-black tracking-[-0.06em] text-white sm:text-[5rem] lg:text-[6.4rem] lg:leading-[0.94]">
                    入戏
                  </span>
                  <span className="mt-2 block text-[1.15rem] font-semibold tracking-tight text-white/92 sm:text-[1.45rem] lg:text-[1.85rem]">
                    脑洞即世界，你就是主角
                  </span>
                </h1>
                <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/78 sm:text-lg sm:leading-8">
                  挑一个世界或角色，马上开始属于你的互动故事。
                </p>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href={heroPrimaryAction.href}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-brand shadow-lg shadow-slate-950/15 transition hover:bg-white/92"
                >
                  {heroPrimaryAction.label}
                </Link>
                <Link
                  href={heroSecondaryAction.href}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-white/14 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.14]"
                >
                  {heroSecondaryAction.label}
                </Link>
              </div>

              <div className="mt-7 lg:hidden">
                {renderHeroLeadCard('min-h-[22rem] sm:min-h-[24rem]')}
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {heroEntries.map((entry) => renderHeroEntryCard(entry))}
              </div>
            </div>

            <div className="hidden lg:block lg:min-w-0">
              {renderHeroLeadCard('lg:min-h-[29rem]')}
            </div>
          </div>
        </div>
      </section>

      {listFetchError && !loading && (
        <div className="mx-auto w-full max-w-[100rem] px-4 pb-2 sm:px-6 xl:px-8" role="alert">
          <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-900">{STATUS_COPY.error.default}</p>
            <button
              type="button"
              onClick={handleRetryLists}
              className="ui-btn ui-btn-primary rounded-lg px-4 py-2 text-sm sm:shrink-0"
            >
              {STATUS_COPY.retry}
            </button>
          </div>
        </div>
      )}

      {user && personalizedWorlds.length > 0 && (
        <section className="mx-auto w-full max-w-[100rem] px-4 pb-10 sm:px-6 xl:px-8">
          {renderShelfHeader({
            eyebrow: '继续入戏',
            title: personalizedSectionTitle,
            summary: recentSession ? '回到刚停下来的那段。' : '这几段大概率合你口味。',
            href: favoriteWorlds.length > 0 ? '/profile?tab=favorites' : '/profile?tab=history',
            linkLabel: favoriteWorlds.length > 0 ? '看收藏' : '看最近',
            count: Math.min(personalizedWorlds.length, 3),
            sortLabel: recentSession ? '最近在看' : '你可能会喜欢',
            tone: 'emerald',
          })}
          {renderLaneCards(personalizedWorlds.slice(0, 3))}
        </section>
      )}

      {(loading || adventureShelfWorlds.length > 0) && (
        <section className="mx-auto w-full max-w-[100rem] px-4 pb-10 sm:px-6 xl:px-8">
          {renderShelfHeader({
            eyebrow: '世界冒险',
            title: '挑个世界进场',
            summary: '更看开场、设定和剧情走向的，从这里进场。',
            href: '/explore?board=adventure&sort=hot',
            linkLabel: '看更多世界',
            count: adventureShelfWorlds.length,
            sortLabel: '热门世界',
            tone: 'brand',
          })}
          {loading ? (
            <div className="grid gap-4 sm:auto-rows-fr md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[23.5rem] animate-pulse rounded-[1.7rem] bg-brand-50" />
              ))}
            </div>
          ) : adventureShelfWorlds.length > 0 ? (
            renderLaneCards(adventureShelfWorlds, 'adventure')
          ) : null}
        </section>
      )}

      {(loading || characterShelfWorlds.length > 0) && (
        <section className="mx-auto w-full max-w-[100rem] px-4 pb-10 sm:px-6 xl:px-8">
          {renderShelfHeader({
            eyebrow: '角色互动',
            title: '挑个角色入戏',
            summary: '更看接话感、关系张力和人物气质的，从这里入戏。',
            href: '/explore?board=character&sort=hot',
            linkLabel: '看更多角色',
            count: characterShelfWorlds.length,
            sortLabel: '热门角色',
            tone: 'rose',
          })}
          {loading ? (
            <div className="grid gap-4 sm:auto-rows-fr md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[23.5rem] animate-pulse rounded-[1.7rem] bg-rose-50" />
              ))}
            </div>
          ) : characterShelfWorlds.length > 0 ? (
            renderLaneCards(characterShelfWorlds, 'character')
          ) : null}
        </section>
      )}

      {(loading || newestShelfWorlds.length > 0) && (
        <section className="mx-auto w-full max-w-[100rem] px-4 pb-12 sm:px-6 xl:px-8">
          {renderShelfHeader({
            eyebrow: '最新开场',
            title: '刚刚开场的故事',
            summary: '想看新开场的故事，从这里开始。',
            href: '/explore?sort=latest',
            linkLabel: '看最新故事',
            count: newestShelfWorlds.length,
            sortLabel: '最新',
            tone: 'gray',
          })}
          {loading ? (
            <div className="grid gap-4 sm:auto-rows-fr md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-[23.5rem] animate-pulse rounded-[1.7rem] bg-gray-100" />
              ))}
            </div>
          ) : newestShelfWorlds.length > 0 ? (
            renderLaneCards(newestShelfWorlds)
          ) : null}
        </section>
      )}
    </>
  );
}
