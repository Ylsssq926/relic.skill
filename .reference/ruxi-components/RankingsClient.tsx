'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { WorldData } from '@/components/WorldCard';
import { STATUS_COPY } from '@/config/copy';
import { SITE_CONFIG } from '@/config/site';
import { applyWorldStatsUpdate, WORLD_STATS_UPDATED_EVENT, type WorldStatsUpdateDetail, worldsAPI } from '@/lib/api';
import { formatCount, getDisplayInitial, normalizeWorlds } from '@/lib/utils';

type Tab = 'hot' | 'liked' | 'newest';
type Board = '' | 'adventure' | 'character';

const BOARD_SWITCHES: { key: Board; label: string }[] = [
  { key: '', label: '全部' },
  { key: 'character', label: '角色' },
  { key: 'adventure', label: '世界' },
];

const BOARD_META: Record<Board, { title: string; badge: string; wrapperClass: string; badgeClass: string }> = {
  '': {
    title: '热门榜单',
    badge: '🏆 大家正在入戏',
    wrapperClass: 'border border-brand/10 bg-white shadow-sm shadow-brand/5',
    badgeClass: 'bg-brand/10 text-brand',
  },
  adventure: {
    title: '世界热门榜',
    badge: '🌍 热门世界，正在开场',
    wrapperClass: 'border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-brand/5 shadow-sm shadow-sky-100/50',
    badgeClass: 'bg-sky-100 text-sky-700',
  },
  character: {
    title: '角色热门榜',
    badge: '💕 热门角色，等你入戏',
    wrapperClass: 'border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50 shadow-sm shadow-rose-100/50',
    badgeClass: 'bg-rose-100 text-rose-600',
  },
};

const GENRE_MAP = new Map<string, (typeof SITE_CONFIG.genres)[number]>(SITE_CONFIG.genres.map((genre) => [genre.key, genre]));
const PLAY_TYPE_MAP = new Map<string, (typeof SITE_CONFIG.playTypes)[number]>(SITE_CONFIG.playTypes.map((playType) => [playType.key, playType]));
const GENRE_GRADIENTS = SITE_CONFIG.genreGradients as Record<string, string>;
const INITIAL_VISIBLE_COUNT = 8;
const LOAD_MORE_STEP = 4;

function getTabs(_board: Board): { key: Tab; label: string }[] {
  return [
    { key: 'hot', label: '热门' },
    { key: 'liked', label: '收藏最多' },
    { key: 'newest', label: '最新' },
  ];
}

const TAB_SORT_MAP: Record<Tab, string> = {
  hot: 'hot',
  liked: 'likes',
  newest: 'latest',
};

function pickRankingWorlds(payload: unknown, currentTab: Tab): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
  }

  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;
  const candidates = currentTab === 'hot'
    ? [data.hot, data.worlds, data.featured, data.items, data.list]
    : currentTab === 'newest'
      ? [data.newest, data.worlds, data.featured, data.items, data.list]
      : [data.worlds, data.liked, data.likes, data.items, data.list];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    }
  }

  return null;
}

function normalizeBoardParam(raw: string | null): Board {
  if (raw === 'adventure' || raw === 'character') return raw;
  return '';
}

function normalizeTabParam(raw: string | null): Tab {
  if (raw === 'liked' || raw === 'newest') return raw;
  return 'hot';
}

function getBoardToneClasses(board: Board) {
  if (board === 'character') {
    return {
      activeCard: 'border-rose-200 bg-rose-50 shadow-sm',
      activeText: 'text-rose-500',
      tabActive: 'bg-rose-500 text-white shadow-sm',
    };
  }

  if (board === 'adventure') {
    return {
      activeCard: 'border-sky-200 bg-sky-50 shadow-sm',
      activeText: 'text-sky-700',
      tabActive: 'bg-sky-600 text-white shadow-sm',
    };
  }

  return {
    activeCard: 'border-brand/20 bg-brand/5 shadow-sm',
    activeText: 'text-brand',
    tabActive: 'bg-brand text-white shadow-sm',
  };
}

function getRankNumberClass(rank: number) {
  if (rank === 1) return 'text-amber-500 text-lg font-black';
  if (rank === 2) return 'text-gray-400 text-lg font-bold';
  if (rank === 3) return 'text-orange-400 text-lg font-bold';
  return 'text-gray-400 text-sm font-medium';
}

function getRankRowBackgroundClass(rank: number) {
  if (rank === 1) return 'bg-amber-50/60';
  if (rank === 2) return 'bg-gray-50/80';
  if (rank === 3) return 'bg-orange-50/40';
  return '';
}

function getWorldMetaText(world: WorldData) {
  const genreLabel = GENRE_MAP.get(world.genre)?.name || '';
  const playTypeLabel = PLAY_TYPE_MAP.get(world.playType || 'world')?.name || '';
  const parts = Array.from(new Set([genreLabel, playTypeLabel].filter(Boolean)));
  return parts.length > 0 ? parts.join(' · ') : '互动故事';
}

function getWorldMetric(world: WorldData, currentTab: Tab) {
  if (currentTab === 'liked') {
    return {
      value: formatCount(Math.max(world.likeCount, 0)),
      unit: '收藏',
    };
  }

  if (world.playCount > 0) {
    return {
      value: formatCount(world.playCount),
      unit: '次开局',
    };
  }

  if (world.likeCount > 0) {
    return {
      value: formatCount(world.likeCount),
      unit: '收藏',
    };
  }

  if (currentTab === 'newest') {
    return {
      value: '新作',
      unit: '刚上榜',
    };
  }

  return {
    value: '0',
    unit: '次开局',
  };
}

function RankingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialBoard = normalizeBoardParam(searchParams.get('board'));
  const initialTab = normalizeTabParam(searchParams.get('tab'));

  const [board, setBoard] = useState<Board>(initialBoard);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [worlds, setWorlds] = useState<WorldData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map<string, WorldData[]>());

  const isCharacterBoard = board === 'character';
  const isAdventureBoard = board === 'adventure';
  const currentBoardMeta = BOARD_META[board];
  const currentTabs = getTabs(board);
  const currentTone = getBoardToneClasses(board);
  const currentTabLabel = currentTabs.find((item) => item.key === tab)?.label || '热门榜单';
  const exploreHref = board === 'character' ? '/explore?board=character' : board === 'adventure' ? '/explore?board=adventure' : '/explore';
  const exploreLabel = board === 'character' ? '先看看角色' : board === 'adventure' ? '先看看世界' : '先看看';
  const cacheKey = (currentTab: Tab, currentBoard: Board) => `${currentTab}__${currentBoard}`;

  const patchWorldList = useCallback((list: WorldData[], detail: WorldStatsUpdateDetail) => {
    const nextList = list.map((item) => applyWorldStatsUpdate(item as unknown as Record<string, unknown>, detail) as unknown as WorldData);
    return nextList.some((item, index) => item !== list[index]) ? nextList : list;
  }, []);

  useEffect(() => {
    const handleWorldStatsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<WorldStatsUpdateDetail>).detail;
      if (!detail?.id) return;

      setWorlds((prev) => patchWorldList(prev, detail));
      cacheRef.current = new Map(
        Array.from(cacheRef.current.entries()).map(([key, value]) => [key, patchWorldList(value, detail)]),
      );
    };

    window.addEventListener(WORLD_STATS_UPDATED_EVENT, handleWorldStatsUpdated);
    return () => window.removeEventListener(WORLD_STATS_UPDATED_EVENT, handleWorldStatsUpdated);
  }, [patchWorldList]);

  useEffect(() => {
    const nextBoard = normalizeBoardParam(searchParams.get('board'));
    const nextTab = normalizeTabParam(searchParams.get('tab'));
    setBoard((prev) => (prev === nextBoard ? prev : nextBoard));
    setTab((prev) => (prev === nextTab ? prev : nextTab));
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (board) params.set('board', board);
    if (tab !== 'hot') params.set('tab', tab);
    const qs = params.toString();
    const newUrl = pathname + (qs ? `?${qs}` : '');
    if (window.location.pathname + window.location.search !== newUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [board, tab, pathname, router]);

  const fetchWorlds = useCallback(async (currentTab: Tab, currentBoard: Board, signal?: AbortSignal) => {
    const key = cacheKey(currentTab, currentBoard);
    const cached = cacheRef.current.get(key);
    if (cached) {
      setWorlds(cached);
      setError('');
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError('');

    try {
      const requestOptions = signal ? { signal } : undefined;
      let rawWorlds: Record<string, unknown>[] | null = null;

      if (currentTab === 'hot' || currentTab === 'newest') {
        try {
          const featuredRes = await worldsAPI.featured(currentBoard ? { board: currentBoard } : undefined, requestOptions);
          const featuredData = featuredRes.data || featuredRes;
          rawWorlds = pickRankingWorlds(featuredData, currentTab);
        } catch (featuredError) {
          console.warn('[Rankings] featured 榜单读取失败，回退到 list 接口', {
            tab: currentTab,
            board: currentBoard,
            err: featuredError,
          });
        }
      }

      if (!rawWorlds) {
        const sort = TAB_SORT_MAP[currentTab];
        const params: Parameters<typeof worldsAPI.list>[0] = { sort, limit: SITE_CONFIG.pagination.rankingWorldsLimit };
        if (currentBoard) params.board = currentBoard;
        const res = await worldsAPI.list(params, requestOptions);
        const data = res.data || res;
        rawWorlds = pickRankingWorlds(data, currentTab);
      }

      if (signal?.aborted || requestId !== requestIdRef.current) return;
      if (!rawWorlds) {
        throw new Error('排行榜数据返回格式异常，请稍后重试');
      }

      const normalized = normalizeWorlds(rawWorlds);
      cacheRef.current.set(key, normalized);
      setWorlds(normalized);
    } catch (err: unknown) {
      if (signal?.aborted || requestId !== requestIdRef.current) return;
      console.error('[Rankings] 加载榜单失败', { tab: currentTab, board: currentBoard, err });
      setWorlds([]);
      setError(err instanceof Error ? err.message : STATUS_COPY.error.default);
    } finally {
      if (!signal?.aborted && requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    cacheRef.current.clear();
  }, [board]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchWorlds(tab, board, controller.signal);
    return () => {
      controller.abort();
    };
  }, [tab, board, fetchWorlds]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [board, tab]);

  const resultCount = worlds.length;
  const boardDescription = isCharacterBoard
    ? '先看看最近大家都在和哪些角色入戏。'
    : isAdventureBoard
      ? '先看看最近哪些世界最适合进场。'
      : '先看看大家最近都在入什么戏。';
  const hotTabCtaLabel = board === 'character' ? '看角色热门榜' : board === 'adventure' ? '看世界热门榜' : '看热门榜单';
  const visibleWorlds = worlds.slice(0, visibleCount);
  const hasMoreWorlds = visibleCount < worlds.length;

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-6 sm:px-6 xl:px-8">
      <div className={`mb-4 overflow-hidden rounded-[2rem] px-4 py-3 shadow-sm sm:px-5 sm:py-4 ${currentBoardMeta.wrapperClass}`}>
        <div className="flex flex-col gap-3.5">
          <div className="min-w-0 max-w-3xl">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${currentBoardMeta.badgeClass}`}>
              {currentBoardMeta.badge}
            </span>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h1 className="text-[1.55rem] font-bold text-gray-900 sm:text-3xl">{currentBoardMeta.title}</h1>
              {!loading && !error && (
                <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
                  {currentTabLabel} · {resultCount} 条
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {boardDescription}
            </p>
          </div>

          <div className="overflow-x-auto overscroll-x-contain hide-scrollbar pb-1 sm:overflow-visible sm:pb-0">
            <div className="flex w-max gap-2 pr-1 sm:w-full sm:flex-wrap">
              {BOARD_SWITCHES.map((item) => {
                const isActive = board === item.key;
                return (
                  <button
                    key={item.key || 'all'}
                    type="button"
                    onClick={() => setBoard(item.key)}
                    className={`min-h-[44px] shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                      isActive ? `${currentTone.activeCard} ${currentTone.activeText}` : 'border-gray-200 bg-white text-gray-600 hover:border-brand/30'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-x-auto overscroll-x-contain hide-scrollbar pb-1 sm:overflow-visible sm:pb-0">
            <div role="tablist" aria-label="排行榜分类" className="flex w-max gap-2 pr-1 sm:w-full sm:flex-wrap">
              {currentTabs.map((current) => (
                <button
                  key={current.key}
                  role="tab"
                  aria-selected={tab === current.key}
                  onClick={() => setTab(current.key)}
                  className={`min-h-[44px] shrink-0 rounded-full px-4 py-2 text-xs font-medium transition-all cursor-pointer sm:px-5 sm:text-sm ${
                    tab === current.key ? currentTone.tabActive : 'border border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand'
                  }`}
                >
                  {current.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {loading && (
        <div className="rounded-[1.75rem] border border-gray-100 bg-white p-2 shadow-sm shadow-brand/5 sm:p-3">
          <div className="space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3">
                <div className="h-6 w-8 shrink-0 rounded-full bg-gray-100 animate-pulse" />
                <div className="h-12 w-12 shrink-0 rounded-xl bg-gray-100 animate-pulse sm:h-14 sm:w-14" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-3/5 rounded-full bg-gray-100 animate-pulse" />
                  <div className="h-3 w-2/5 rounded-full bg-gray-100 animate-pulse" />
                </div>
                <div className="shrink-0 space-y-2 text-right">
                  <div className="ml-auto h-4 w-14 rounded-full bg-gray-100 animate-pulse" />
                  <div className="ml-auto h-3 w-10 rounded-full bg-gray-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-col items-center py-20 text-center text-gray-400">
          <svg className="mb-4 h-16 w-16 opacity-40 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-base text-gray-500">{error}</p>
          <p className="mt-2 max-w-md text-sm text-gray-400">
            {isCharacterBoard
              ? '先去看看角色也行。'
              : isAdventureBoard
                ? '先去看看世界也行。'
                : '先去探索也行。'}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fetchWorlds(tab, board)}
              className="rounded-full bg-brand px-6 py-2 text-sm font-medium text-white transition-all hover:bg-brand/90 cursor-pointer"
            >
              {STATUS_COPY.retry}
            </button>
            <Link
              href={exploreHref}
              className="rounded-full border border-gray-200 px-6 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
            >
              {exploreLabel}
            </Link>
          </div>
        </div>
      )}

      {!loading && !error && worlds.length > 0 && (
        <>
          <div className="rounded-[1.75rem] border border-gray-100 bg-white p-2 shadow-sm shadow-brand/5 sm:p-3">
            <div className="space-y-1">
              {visibleWorlds.map((world, index) => {
                const rankNumber = index + 1;
                const metric = getWorldMetric(world, tab);
                const gradient = GENRE_GRADIENTS[world.genre] || 'from-slate-600 to-slate-400';
                const genre = GENRE_MAP.get(world.genre);

                return (
                  <Link
                    key={world.id}
                    href={`/world/${world.id}`}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-gray-50 ${getRankRowBackgroundClass(rankNumber)}`}
                  >
                    <div className={`w-8 shrink-0 text-center ${getRankNumberClass(rankNumber)}`}>
                      {rankNumber}
                    </div>

                    {world.cover ? (
                      <Image
                        src={world.cover}
                        alt={`${world.title} 的封面图`}
                        width={56}
                        height={56}
                        sizes="(max-width: 640px) 48px, 56px"
                        className="h-12 w-12 shrink-0 rounded-xl object-cover sm:h-14 sm:w-14"
                        loading="lazy"
                        unoptimized
                      />
                    ) : (
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-base font-black text-white sm:h-14 sm:w-14 sm:text-lg`}>
                        {genre?.icon || getDisplayInitial(world.title, '戏')}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-brand">
                        {world.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {getWorldMetaText(world)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gray-700">{metric.value}</p>
                      <p className="text-xs text-gray-400">{metric.unit}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {hasMoreWorlds && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => Math.min(prev + LOAD_MORE_STEP, worlds.length))}
                className="inline-flex min-h-[44px] items-center rounded-full border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:border-brand hover:text-brand cursor-pointer"
              >
                加载更多
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !error && worlds.length === 0 && (
        <div className="flex flex-col items-center py-20 text-center text-gray-400">
          <svg className="mb-4 h-16 w-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          <p className="text-base font-semibold text-gray-700">{STATUS_COPY.empty.rankings}</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-gray-500">
            先去看看，晚点再来。
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {tab !== 'hot' ? (
              <button
                type="button"
                onClick={() => setTab('hot')}
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand/90 cursor-pointer"
              >
                {hotTabCtaLabel}
              </button>
            ) : null}
            <Link
              href={exploreHref}
              className="rounded-full border border-gray-200 px-5 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
            >
              {exploreLabel}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RankingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">{STATUS_COPY.loading.rankings}</div></div>}>
      <RankingsContent />
    </Suspense>
  );
}
