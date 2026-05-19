'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, Suspense, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { STATUS_COPY } from '@/config/copy';
import { SITE_CONFIG } from '@/config/site';
import { WorldCard } from '@/components/WorldCard';
import type { WorldData } from '@/components/WorldCard';
import { CharacterModal, type CharacterProfile } from '@/components/CharacterModal';
import { applyWorldStatsUpdate, WORLD_STATS_UPDATED_EVENT, type WorldStatsUpdateDetail, worldsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { buildCharacterPreviewCharacter, buildCharacterShowcaseItems } from '@/lib/character-explore';
import { buildWorldStartHref, normalizeWorlds } from '@/lib/utils';

type SortKey = 'hot' | 'latest' | 'rating';
type Board = '' | 'adventure' | 'character';

const BOARD_PLAY_TYPES: Record<string, string[]> = {
  adventure: ['world', 'dungeon'],
  character: ['romance', 'role_play', 'companion'],
};

type BoardGuide = {
  badge: string;
  title: string;
  searchPlaceholder: string;
  searchLabel: string;
  genreLabel: string;
  playTypeLabel: string;
  sortLabel: string;
  loadingText: string;
  filteredEmptyText: string;
  idleText: string;
  emptyTitle: string;
  emptyDescription: string;
  resetLabel: string;
  popularHref: string;
  popularLabel: string;
  resultCountLabel: (total: number) => string;
  loadMoreLabel: string;
};

const BOARD_GUIDES: Record<'default' | 'adventure' | 'character', BoardGuide> = {
  default: {
    badge: '🔎 找一段入戏',
    title: '今天想怎么入戏',
    searchPlaceholder: '搜世界、角色、关系、一句话',
    searchLabel: '搜索故事',
    genreLabel: '题材',
    playTypeLabel: '方式',
    sortLabel: '排序',
    loadingText: STATUS_COPY.loading.explore,
    filteredEmptyText: STATUS_COPY.empty.explore,
    idleText: '搜个词，或者直接挑一段。',
    emptyTitle: STATUS_COPY.empty.default,
    emptyDescription: STATUS_COPY.empty.explore,
    resetLabel: STATUS_COPY.reset,
    popularHref: '/explore?sort=hot',
    popularLabel: '看看热门',
    resultCountLabel: (total) => `${total} 条`,
    loadMoreLabel: '再看更多',
  },
  adventure: {
    badge: '🌍 挑个世界进场',
    title: '找个想进的世界',
    searchPlaceholder: '搜世界观、势力、地图、一句话',
    searchLabel: '搜索世界',
    genreLabel: '题材',
    playTypeLabel: '方式',
    sortLabel: '排序',
    loadingText: STATUS_COPY.loading.explore,
    filteredEmptyText: STATUS_COPY.empty.explore,
    idleText: '先点个题材，挑个世界进场。',
    emptyTitle: STATUS_COPY.empty.default,
    emptyDescription: STATUS_COPY.empty.explore,
    resetLabel: STATUS_COPY.reset,
    popularHref: '/explore?board=adventure&sort=hot',
    popularLabel: '看看热门世界',
    resultCountLabel: (total) => `${total} 个世界`,
    loadMoreLabel: '再看更多世界',
  },
  character: {
    badge: '💕 找个想聊的人',
    title: '找个想聊的人',
    searchPlaceholder: '搜角色名、关系词、相处感',
    searchLabel: '搜索角色',
    genreLabel: '题材',
    playTypeLabel: '方式',
    sortLabel: '排序',
    loadingText: STATUS_COPY.loading.explore,
    filteredEmptyText: STATUS_COPY.empty.explore,
    idleText: '先点个关系词，找个想聊的人。',
    emptyTitle: STATUS_COPY.empty.default,
    emptyDescription: STATUS_COPY.empty.explore,
    resetLabel: STATUS_COPY.reset,
    popularHref: '/explore?board=character&sort=hot',
    popularLabel: '看看热门角色',
    resultCountLabel: (total) => `${total} 条`,
    loadMoreLabel: '再看更多角色',
  },
};

const SORT_OPTIONS: { key: SortKey; label: string; apiSort: string }[] = [
  { key: 'hot', label: '热门', apiSort: 'hot' },
  { key: 'latest', label: '最新', apiSort: 'latest' },
  { key: 'rating', label: '好评', apiSort: 'rating' },
];

const BOARD_SWITCHES = [
  { key: '', label: '全部', href: '/explore' },
  { key: 'character', label: '角色', href: '/explore?board=character' },
  { key: 'adventure', label: '世界', href: '/explore?board=adventure' },
] as const;

const BOARD_SEARCH_SHORTCUTS: Record<'default' | 'adventure' | 'character', string[]> = {
  default: ['校园', '病娇', '救赎', '悬疑'],
  adventure: ['宗门', '秘境', '末世', '悬疑'],
  character: ['病娇', '青梅竹马', '救赎', '年上'],
};

function sortParamToSortKey(raw: string | null): SortKey {
  if (!raw) return 'hot';
  const v = raw.toLowerCase();
  if (v === 'popular' || v === 'hot') return 'hot';
  if (v === 'newest' || v === 'latest' || v === 'new') return 'latest';
  if (v === 'likes' || v === 'rating' || v === 'top_rated') return 'rating';
  return 'hot';
}

function normalizeBoardPlayType(board: string, playType: string) {
  if (!playType) return '';
  const allowedPlayTypes = BOARD_PLAY_TYPES[board];
  if (!allowedPlayTypes) return playType;
  return allowedPlayTypes.includes(playType) ? playType : '';
}

function getPlayTypeDisplayName(playTypeKey: string, board: Board, fallback: string) {
  if (board === 'character') {
    switch (playTypeKey) {
      case 'romance':
        return '恋爱';
      case 'companion':
        return '陪伴';
      case 'role_play':
        return '代入角色';
      default:
        return fallback;
    }
  }

  if (board === 'adventure') {
    switch (playTypeKey) {
      case 'world':
        return '世界冒险';
      case 'dungeon':
        return '短篇副本';
      default:
        return fallback;
    }
  }

  return fallback;
}

const PAGE_SIZE = SITE_CONFIG.pagination.explorePageSize;

export interface ExploreInitialState {
  board: string;
  genre: string;
  playType: string;
  search: string;
  sort: string;
  worlds: WorldData[];
  total: number;
  hasInitialData: boolean;
}

interface ExplorePageProps {
  initialState: ExploreInitialState;
}

function buildExploreCacheKey(params: {
  board: string;
  genre: string;
  playType: string;
  sort: string;
  page: number;
  search: string;
}) {
  return JSON.stringify(params);
}

function ExploreContent({ initialState }: ExplorePageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const board = (searchParams.get('board') || '') as Board;
  const isAdventureBoard = board === 'adventure';
  const isCharacterBoard = board === 'character';
  const currentBoardGuide = isCharacterBoard
    ? BOARD_GUIDES.character
    : isAdventureBoard
      ? BOARD_GUIDES.adventure
      : BOARD_GUIDES.default;
  const cardVariant = isCharacterBoard ? 'character' : isAdventureBoard ? 'adventure' : 'default';
  const activeBoardKey = isCharacterBoard ? 'character' : isAdventureBoard ? 'adventure' : '';
  const initialQuery = searchParams.get('q') || '';
  const initialGenre = searchParams.get('genre') || '';
  const initialPlayType = normalizeBoardPlayType(board, searchParams.get('play_type') || '');
  const initialSort = sortParamToSortKey(searchParams.get('sort'));
  const availablePlayTypes = BOARD_PLAY_TYPES[board]
    ? SITE_CONFIG.playTypes.filter((pt) => BOARD_PLAY_TYPES[board].includes(pt.key))
    : SITE_CONFIG.playTypes;
  const activeSearchShortcuts = isCharacterBoard
    ? BOARD_SEARCH_SHORTCUTS.character
    : isAdventureBoard
      ? BOARD_SEARCH_SHORTCUTS.adventure
      : BOARD_SEARCH_SHORTCUTS.default;
  const isAuthenticated = Boolean(user);

  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [searchPending, setSearchPending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const initialRequestConsumedRef = useRef(false);
  const cacheRef = useRef(new Map<string, { worlds: WorldData[]; total: number }>(
    initialState.hasInitialData
      ? [[buildExploreCacheKey({
          board: initialState.board || '',
          genre: initialState.genre || '',
          playType: initialState.playType || '',
          sort: initialState.sort || 'hot',
          page: 1,
          search: initialState.search.trim(),
        }), { worlds: initialState.worlds, total: initialState.total }]]
      : [],
  ));
  const [genre, setGenre] = useState(initialGenre);
  const [playType, setPlayType] = useState(initialPlayType);
  const [sort, setSort] = useState<SortKey>(initialSort);
  const [page, setPage] = useState(1);
  const [worlds, setWorlds] = useState<WorldData[]>(() => initialState.worlds);
  const [total, setTotal] = useState(() => initialState.total);
  const [loading, setLoading] = useState(() => !initialState.hasInitialData);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [characterSearchFocused, setCharacterSearchFocused] = useState(false);
  const [previewWorld, setPreviewWorld] = useState<WorldData | null>(null);
  const [previewCharacter, setPreviewCharacter] = useState<CharacterProfile | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const previewRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

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
        Array.from(cacheRef.current.entries()).map(([key, value]) => [
          key,
          { ...value, worlds: patchWorldList(value.worlds, detail) },
        ]),
      );
    };

    window.addEventListener(WORLD_STATS_UPDATED_EVENT, handleWorldStatsUpdated);
    return () => window.removeEventListener(WORLD_STATS_UPDATED_EVENT, handleWorldStatsUpdated);
  }, [patchWorldList]);

  useEffect(() => {
    setShowMobileFilters(false);
    setCharacterSearchFocused(false);
  }, [board]);

  useEffect(() => {
    if (!showMobileFilters) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showMobileFilters]);

  useEffect(() => {
    setPlayType((prev) => {
      const normalized = normalizeBoardPlayType(board, prev);
      return normalized === prev ? prev : normalized;
    });
  }, [board]);

  useEffect(() => {
    const mapped = sortParamToSortKey(searchParams.get('sort'));
    setSort((prev) => (mapped !== prev ? mapped : prev));

    const urlGenre = searchParams.get('genre') ?? '';
    setGenre((prev) => (urlGenre !== prev ? urlGenre : prev));

    const urlBoard = searchParams.get('board') || '';
    const urlPlayType = normalizeBoardPlayType(urlBoard, searchParams.get('play_type') ?? '');
    setPlayType((prev) => (urlPlayType !== prev ? urlPlayType : prev));

    const urlQ = searchParams.get('q') ?? '';
    setSearch((prev) => (urlQ !== prev ? urlQ : prev));
    setDebouncedSearch((prev) => (urlQ !== prev ? urlQ : prev));
  }, [searchParams]);

  useEffect(() => {
    if (search === debouncedSearch) return;
    setSearchPending(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setSearchPending(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, debouncedSearch]);

  const fetchWorlds = useCallback(async (currentPage: number, append: boolean, signal?: AbortSignal) => {
    const requestId = ++requestIdRef.current;
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError('');

    const apiSort = SORT_OPTIONS.find((s) => s.key === sort)?.apiSort || 'hot';
    const cacheKey = buildExploreCacheKey({
      board: board || '',
      genre: genre || '',
      playType: playType || '',
      sort: apiSort,
      page: currentPage,
      search: debouncedSearch.trim(),
    });
    const cached = cacheRef.current.get(cacheKey);

    if (cached) {
      if (requestId === requestIdRef.current && !signal?.aborted) {
        if (append) {
          setWorlds((prev) => [...prev, ...cached.worlds]);
        } else {
          setWorlds(cached.worlds);
        }
        setTotal(cached.total);
        setLoading(false);
        setLoadingMore(false);
      }
      return;
    }

    try {
      const res = await worldsAPI.list({
        board: board || undefined,
        genre: genre || undefined,
        play_type: playType || undefined,
        sort: apiSort,
        page: currentPage,
        limit: PAGE_SIZE,
        search: debouncedSearch.trim() || undefined,
      }, signal ? { signal } : undefined);
      if (signal?.aborted || requestId !== requestIdRef.current || !mountedRef.current) return;
      const data = res.data || res;
      const fetched: WorldData[] = normalizeWorlds(data.worlds || []);
      const fetchedTotal: number = data.total ?? fetched.length;
      cacheRef.current.set(cacheKey, { worlds: fetched, total: fetchedTotal });

      if (append) {
        setWorlds((prev) => [...prev, ...fetched]);
      } else {
        setWorlds(fetched);
      }
      setTotal(fetchedTotal);
    } catch (err: unknown) {
      if (signal?.aborted || requestId !== requestIdRef.current || !mountedRef.current) return;
      setError(err instanceof Error ? err.message : STATUS_COPY.error.default);
    } finally {
      if (!signal?.aborted && mountedRef.current && requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [board, genre, playType, sort, debouncedSearch]);

  useEffect(() => {
    setPage(1);

    const currentApiSort = SORT_OPTIONS.find((item) => item.key === sort)?.apiSort || 'hot';
    const currentCacheKey = buildExploreCacheKey({
      board: board || '',
      genre: genre || '',
      playType: playType || '',
      sort: currentApiSort,
      page: 1,
      search: debouncedSearch.trim(),
    });
    const initialCacheKey = initialState.hasInitialData
      ? buildExploreCacheKey({
          board: initialState.board || '',
          genre: initialState.genre || '',
          playType: initialState.playType || '',
          sort: initialState.sort || 'hot',
          page: 1,
          search: initialState.search.trim(),
        })
      : '';

    if (!initialRequestConsumedRef.current) {
      initialRequestConsumedRef.current = true;
      if (initialState.hasInitialData && currentCacheKey === initialCacheKey) {
        setError('');
        setLoading(false);
        return;
      }
    }

    const controller = new AbortController();
    void fetchWorlds(1, false, controller.signal);
    return () => {
      controller.abort();
    };
  }, [board, genre, playType, sort, debouncedSearch, fetchWorlds, initialState]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (board) params.set('board', board);
    if (debouncedSearch.trim()) params.set('q', debouncedSearch.trim());
    if (genre) params.set('genre', genre);
    if (playType) params.set('play_type', playType);
    if (sort !== 'hot') params.set('sort', sort);
    const qs = params.toString();
    const newUrl = pathname + (qs ? `?${qs}` : '');
    if (window.location.pathname + window.location.search !== newUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [board, debouncedSearch, genre, playType, sort, pathname, router]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchWorlds(nextPage, true);
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setGenre('');
    setPlayType('');
    setSort('hot');
    setPage(1);
  };

  const hasMore = worlds.length < total;
  const hasActiveFilters = Boolean(search.trim() || genre || playType || sort !== 'hot');
  const activeFilterPills = [
    debouncedSearch.trim()
      ? {
          key: 'search',
          label: `关键词：${debouncedSearch.trim()}`,
          clear: () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            setSearchPending(false);
            setSearch('');
            setDebouncedSearch('');
            setPage(1);
          },
        }
      : null,
    genre
      ? {
          key: 'genre',
          label: `题材 · ${SITE_CONFIG.genres.find((g) => g.key === genre)?.name || genre}`,
          clear: () => setGenre(''),
        }
      : null,
    playType
      ? {
          key: 'play-type',
          label: `${currentBoardGuide.playTypeLabel}：${getPlayTypeDisplayName(
            playType,
            board,
            availablePlayTypes.find((pt) => pt.key === playType)?.name || playType,
          )}`,
          clear: () => setPlayType(''),
        }
      : null,
    sort !== 'hot'
      ? {
          key: 'sort',
          label: `${currentBoardGuide.sortLabel}：${SORT_OPTIONS.find((item) => item.key === sort)?.label || sort}`,
          clear: () => setSort('hot'),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;
  const activeFilterCount = activeFilterPills.length;
  const isPlatformEmpty = !loading && !error && worlds.length === 0 && total === 0 && !hasActiveFilters;
  const platformEmptyTitle = STATUS_COPY.empty.default;
  const platformEmptyDescription = STATUS_COPY.empty.explore;
  const platformEmptyLead = STATUS_COPY.empty.default;
  const showInlineRefreshHint = loading && !searchPending && worlds.length > 0;
  const showLoadingSkeleton = loading && !searchPending && worlds.length === 0;
  const resultGridClass = 'grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3 2xl:grid-cols-4';
  const accentSoftClass = isCharacterBoard
    ? 'border-rose-200 bg-rose-50 text-rose-600'
    : isAdventureBoard
      ? 'border-brand/20 bg-brand-50 text-brand'
      : 'border-brand/20 bg-brand/5 text-brand';
  const accentSoftSolidClass = isCharacterBoard
    ? 'bg-rose-500 text-white'
    : isAdventureBoard
      ? 'bg-brand text-white'
      : 'bg-brand text-white';
  const searchBorderClass = isCharacterBoard
    ? 'border-rose-100 ring-1 ring-rose-50'
    : isAdventureBoard
      ? 'border-brand/10 ring-1 ring-brand/5'
      : 'border-gray-100';
  const otherBoardShortcut = isCharacterBoard
    ? { href: '/explore?board=adventure', label: '看看世界' }
    : isAdventureBoard
      ? { href: '/explore?board=character', label: '看看角色' }
      : null;
  const trimmedSearch = search.trim();
  const emptySuggestionKeywords = activeSearchShortcuts
    .filter((keyword) => keyword !== trimmedSearch && keyword !== debouncedSearch.trim())
    .slice(0, 4);
  const boardIntro = isCharacterBoard
    ? '先听第一句，有感觉再进场。'
    : isAdventureBoard
      ? '先看开场，想进场就点。'
      : '先看看，喜欢就进场。';
  const rankingsHref = activeBoardKey ? `/rankings?board=${activeBoardKey}` : '/rankings';
  const rankingsLabel = '看看榜单';
  const characterShowcaseItems = useMemo(
    () => (isCharacterBoard ? buildCharacterShowcaseItems(worlds as unknown as Record<string, unknown>[], 3) : []),
    [isCharacterBoard, worlds],
  );
  const leadCharacterShowcase = characterShowcaseItems[0] || null;
  const secondaryCharacterShowcases = characterShowcaseItems.slice(1);
  const previewCharacterName = typeof previewCharacter?.name === 'string' ? previewCharacter.name.trim() : '';
  const previewActionLabel = previewLoading && !previewCharacterName
    ? STATUS_COPY.loading.detail
    : isAuthenticated
      ? '开始入戏'
      : '登录后开始';

  const applySearchShortcut = useCallback((keyword: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchPending(false);
    setSearch(keyword);
    setDebouncedSearch(keyword);
    setPage(1);
  }, []);

  const closePreview = useCallback(() => {
    previewRequestIdRef.current += 1;
    setPreviewLoading(false);
    setPreviewWorld(null);
    setPreviewCharacter(null);
  }, []);

  const openCharacterPreview = useCallback(async (world: WorldData) => {
    const requestId = ++previewRequestIdRef.current;
    const fallbackCharacter = buildCharacterPreviewCharacter({ listWorld: world as unknown as Record<string, unknown> });

    setPreviewWorld(world);
    setPreviewCharacter(fallbackCharacter as CharacterProfile | null);
    setPreviewLoading(true);

    try {
      const response = await worldsAPI.get(world.id);
      if (!mountedRef.current || requestId !== previewRequestIdRef.current) return;
      const detailWorld = (response.data || response) as Record<string, unknown>;
      const nextCharacter = buildCharacterPreviewCharacter({
        listWorld: world as unknown as Record<string, unknown>,
        detailWorld,
      });
      setPreviewCharacter((nextCharacter || fallbackCharacter) as CharacterProfile | null);
    } catch {
      if (!mountedRef.current || requestId !== previewRequestIdRef.current) return;
      setPreviewCharacter(fallbackCharacter as CharacterProfile | null);
    } finally {
      if (mountedRef.current && requestId === previewRequestIdRef.current) {
        setPreviewLoading(false);
      }
    }
  }, []);

  const handlePreviewStart = useCallback((character: CharacterProfile) => {
    if (!previewWorld) return;
    const target = typeof character.name === 'string' ? character.name.trim() : '';
    const href = buildWorldStartHref(previewWorld.id, isAuthenticated, {
      target,
      characterId: character.is_playable ? character.id ?? undefined : undefined,
    });
    closePreview();
    router.push(href);
  }, [previewWorld, isAuthenticated, closePreview, router]);

  const handlePreviewOpenWorld = useCallback(() => {
    if (!previewWorld) return;
    const href = `/world/${previewWorld.id}`;
    closePreview();
    router.push(href);
  }, [previewWorld, closePreview, router]);

  const renderSearchInput = (large = false, containerClassName = '') => (
    <div className={`flex min-w-0 items-center rounded-[1.5rem] border bg-white shadow-sm ${searchBorderClass} ${containerClassName}`}>
      <svg
        className={`ml-4 shrink-0 text-gray-400 ${large ? 'h-5 w-5' : 'h-5 w-5'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={currentBoardGuide.searchPlaceholder}
        className={`min-w-0 flex-1 bg-transparent px-3 text-gray-700 outline-none placeholder:text-gray-400 ${large ? 'py-4 text-base' : 'py-3.5 text-sm'}`}
        aria-label={currentBoardGuide.searchLabel}
      />
      {searchPending && (
        <svg className="mr-2 h-4 w-4 shrink-0 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {search && !searchPending && (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setDebouncedSearch('');
          }}
          className="mr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
          aria-label="清除搜索"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );

  const renderActiveFilterPills = (scrollable = false) => (
    <div className={scrollable ? 'flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto hide-scrollbar sm:pb-1' : 'flex flex-wrap gap-2'}>
      {activeFilterPills.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.clear}
          className={`inline-flex min-h-[44px] items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${accentSoftClass}`}
        >
          <span className="min-w-0 max-w-[22rem] whitespace-normal break-words text-left sm:max-w-[28rem]">{item.label}</span>
          <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  );

  const renderCharacterShowcaseCard = (item: (typeof characterShowcaseItems)[number], compact = false) => {
    const world = worlds.find((entry) => entry.id === item.worldId);
    if (!world) return null;

    if (compact) {
      return (
        <button
          key={item.worldId}
          type="button"
          onClick={() => openCharacterPreview(world)}
          className="group flex h-full w-full items-stretch gap-3 overflow-hidden rounded-[1.6rem] border border-rose-100 bg-white p-3 text-left shadow-[0_18px_42px_-30px_rgba(244,114,182,0.35)] transition-all hover:-translate-y-0.5 hover:border-rose-200 hover:shadow-[0_24px_52px_-30px_rgba(244,114,182,0.45)]"
        >
          <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-[1.2rem] bg-gradient-to-br from-rose-100 via-white to-orange-100 sm:w-28">
            <Image
              src={item.imageUrl}
              alt={`${item.characterName} 的预览图`}
              fill
              sizes="112px"
              className={item.isCharacterImage ? 'object-cover object-top transition-transform duration-500 group-hover:scale-105' : 'object-cover object-center transition-transform duration-500 group-hover:scale-105'}
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/24 via-transparent to-white/10" />
          </div>
          <div className="min-w-0 flex-1 py-1">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-rose-400">先认识这个人</p>
            <h3 className="mt-2 text-lg font-bold tracking-tight text-gray-950">{item.characterName}</h3>
            <p className="mt-2 line-clamp-2 text-sm font-medium leading-6 text-gray-800">{item.teaser}</p>
            <p className="mt-2 line-clamp-1 text-xs text-gray-500">{item.supportingText}</p>
            <span className="mt-3 inline-flex rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
              先看看
            </span>
          </div>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => openCharacterPreview(world)}
        className="group relative block h-full overflow-hidden rounded-[1.9rem] border border-rose-100 bg-white text-left shadow-[0_24px_64px_-34px_rgba(244,114,182,0.42)] transition-all hover:-translate-y-1 hover:border-rose-200 hover:shadow-[0_32px_80px_-34px_rgba(244,114,182,0.5)]"
      >
        <div className="relative h-full min-h-[280px]">
          <Image
            src={item.imageUrl}
            alt={`${item.characterName} 的预览图`}
            fill
            sizes="(max-width: 1024px) 100vw, 36vw"
            className={item.isCharacterImage ? 'object-cover object-top transition-transform duration-700 group-hover:scale-105' : 'object-cover object-center transition-transform duration-700 group-hover:scale-105'}
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/86 via-slate-950/16 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),_transparent_30%)]" />
          <div className="absolute left-4 top-4 right-4 flex items-center justify-between gap-3">
            <span className="inline-flex rounded-full border border-white/14 bg-white/12 px-3 py-1 text-[11px] font-semibold text-white/88 backdrop-blur-sm">
              角色速览
            </span>
            <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium text-white/74 backdrop-blur-sm">
              {item.proofText}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-5">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70">来自《{item.worldTitle}》</p>
            <h3 className="mt-2 text-[1.9rem] font-black tracking-tight sm:text-[2.15rem]">{item.characterName}</h3>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/88 sm:text-[15px] sm:leading-7">{item.teaser}</p>
            <span className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-rose-500 shadow-sm">
              先看看
            </span>
          </div>
        </div>
      </button>
    );
  };

  const renderCharacterShowcaseSkeleton = () => (
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.92fr)] xl:items-stretch">
      <div className="h-full overflow-hidden rounded-[1.9rem] border border-gray-100 bg-white shadow-[0_24px_64px_-34px_rgba(15,23,42,0.12)] animate-pulse">
        <div className="h-full min-h-[280px] bg-gray-100" />
      </div>
      <div className="hidden h-full grid-rows-2 gap-3 xl:grid">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="flex h-full items-stretch gap-3 overflow-hidden rounded-[1.6rem] border border-gray-100 bg-white p-3 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.12)] animate-pulse"
          >
            <div className="aspect-[3/4] w-24 shrink-0 rounded-[1.2rem] bg-gray-100 sm:w-28" />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 py-1">
              <div className="h-3 w-20 rounded-full bg-gray-100" />
              <div className="h-6 w-24 rounded-full bg-gray-100" />
              <div className="space-y-2">
                <div className="h-3 w-full rounded-full bg-gray-100" />
                <div className="h-3 w-4/5 rounded-full bg-gray-100" />
              </div>
              <div className="h-3 w-2/3 rounded-full bg-gray-100" />
              <div className="h-8 w-20 rounded-full bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCharacterListDivider = () => (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-sm font-semibold text-gray-500">全部角色</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );

  const renderCharacterShowcaseHeader = () => (
    <section className="mb-3 space-y-3">
      <div className="overflow-hidden rounded-[1.8rem] border border-rose-100 bg-[linear-gradient(135deg,rgba(255,241,242,0.92),rgba(255,255,255,0.98),rgba(255,247,237,0.92))] p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full border border-rose-200 bg-white/85 px-3 py-1 text-[11px] font-semibold text-rose-500">
                  今日想聊谁
                </span>
                {!loading && !error ? (
                  <span className="inline-flex rounded-full bg-white/90 px-3 py-1 text-[11px] font-medium text-gray-500">
                    {currentBoardGuide.resultCountLabel(total)}
                  </span>
                ) : null}
              </div>
              <h1 className="mt-2 text-[1.45rem] font-black tracking-tight text-gray-950 sm:text-[1.85rem]">
                找个想聊的人
              </h1>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                先听一句、先看一眼、先感受关系张力。对上了，再进场也不迟。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-gray-500 sm:justify-end">
              <Link href={currentBoardGuide.popularHref} className="transition-colors hover:text-rose-500">
                {currentBoardGuide.popularLabel} →
              </Link>
              <Link href={rankingsHref} className="transition-colors hover:text-rose-500">
                {rankingsLabel} →
              </Link>
            </div>
          </div>

          <div
            className="rounded-[1.6rem] border border-white/75 bg-white/70 p-2.5 shadow-[0_14px_30px_-24px_rgba(244,114,182,0.35)]"
            onFocusCapture={() => setCharacterSearchFocused(true)}
            onBlurCapture={(event) => {
              const nextFocused = event.relatedTarget as Node | null;
              if (!event.currentTarget.contains(nextFocused)) {
                setCharacterSearchFocused(false);
              }
            }}
          >
            {renderSearchInput(false, 'border-rose-100/70 bg-white/90 shadow-none ring-0')}
            <div className={`overflow-hidden transition-all duration-200 ${characterSearchFocused ? 'mt-3 max-h-28 opacity-100' : 'max-h-0 opacity-0'}`}>
              <p className="text-[11px] font-medium text-rose-400">试试这些关系词</p>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {activeSearchShortcuts.map((keyword) => {
                  const isActive = search.trim() === keyword || debouncedSearch.trim() === keyword;
                  return (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => applySearchShortcut(keyword)}
                      className={`min-h-[44px] shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                        isActive
                          ? accentSoftClass
                          : 'border-rose-100 bg-white text-gray-500 hover:border-rose-300 hover:text-rose-500'
                      }`}
                    >
                      {keyword}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">{renderActiveFilterPills(true)}</div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex min-h-[44px] items-center rounded-full border border-rose-100 bg-white px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-rose-300 hover:text-rose-500"
              >
                {currentBoardGuide.resetLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {leadCharacterShowcase ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.92fr)] xl:items-stretch">
          <div className="min-w-0 h-full">{renderCharacterShowcaseCard(leadCharacterShowcase)}</div>
          <div className="hidden h-full grid-rows-2 gap-3 xl:grid">
            {secondaryCharacterShowcases.map((item) => renderCharacterShowcaseCard(item, true))}
          </div>
        </div>
      ) : loading ? renderCharacterShowcaseSkeleton() : null}
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-5 pb-[5.7rem] sm:px-6 sm:py-8 sm:pb-24 lg:pb-8 xl:px-8">
      {isCharacterBoard ? renderCharacterShowcaseHeader() : (
      <div className={`mb-4 overflow-hidden rounded-[1.75rem] border px-4 py-3 shadow-sm sm:px-5 sm:py-4 ${
        isAdventureBoard
          ? 'border-brand/10 bg-gradient-to-r from-brand-50 via-white to-brand/5'
          : 'border-gray-100 bg-gradient-to-r from-gray-50 via-white to-brand/5'
      }`}>
        <div className="flex flex-col gap-4">
          <div className="min-w-0 max-w-3xl">
            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${accentSoftClass}`}>
              {currentBoardGuide.badge}
            </span>
            <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h1 className="text-[1.5rem] font-bold text-gray-900 sm:text-3xl">{currentBoardGuide.title}</h1>
              {!loading && !error && (
                <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-500 shadow-sm">
                  {currentBoardGuide.resultCountLabel(total)}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              {boardIntro}
            </p>
          </div>

          {renderSearchInput(true)}

          {!isAdventureBoard ? (
            <div className="pb-1 sm:pb-0">
              <div className="grid grid-cols-3 gap-2 sm:flex sm:w-full sm:flex-wrap">
                {BOARD_SWITCHES.map((item) => {
                  const isActive = activeBoardKey === item.key;
                  return (
                    <Link
                      key={item.key || 'all'}
                      href={item.href}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-2xl border px-3 py-2 text-center text-xs font-medium transition-all sm:text-sm ${
                        isActive
                          ? `${accentSoftClass} shadow-sm`
                          : 'border-gray-200 bg-white text-gray-600 hover:border-brand/30 hover:text-brand'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="mb-2 text-xs font-medium text-gray-400">不知道搜什么，就从这些词开始</p>
              <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {activeSearchShortcuts.map((keyword) => {
                  const isActive = search.trim() === keyword || debouncedSearch.trim() === keyword;
                  return (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => applySearchShortcut(keyword)}
                      className={`min-h-[44px] shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? accentSoftClass
                          : 'border-gray-200 bg-white text-gray-500 hover:border-brand/30 hover:text-brand'
                      }`}
                    >
                      {keyword}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Link
                href={currentBoardGuide.popularHref}
                className="inline-flex min-h-[40px] items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-brand hover:text-brand"
              >
                {currentBoardGuide.popularLabel}
              </Link>
              <Link
                href={rankingsHref}
                className="inline-flex min-h-[40px] items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-brand hover:text-brand"
              >
                {rankingsLabel}
              </Link>
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">{renderActiveFilterPills(true)}</div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex min-h-[44px] items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:border-brand hover:text-brand"
              >
                {currentBoardGuide.resetLabel}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      )}

      {showMobileFilters && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-[2px] lg:hidden"
            aria-label="关闭探索筛选抽屉"
            onClick={() => setShowMobileFilters(false)}
          />
          <div
            id="explore-mobile-filters"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-hidden rounded-t-[2rem] border-t border-gray-200 bg-white shadow-[0_-20px_60px_-24px_rgba(15,23,42,0.38)] lg:hidden"
          >
            <div className="flex justify-center pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-gray-300" />
            </div>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 pb-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">筛选</p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-500 transition-colors hover:border-brand hover:text-brand"
                aria-label="关闭筛选抽屉"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[calc(78dvh-8.5rem)] space-y-4 overflow-y-auto px-4 py-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">{currentBoardGuide.sortLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSort(s.key)}
                      aria-pressed={sort === s.key}
                      className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                        sort === s.key
                          ? accentSoftSolidClass
                          : 'border border-gray-200 bg-white text-gray-500 hover:border-brand hover:text-brand'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">随手点词</p>
                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                  {activeSearchShortcuts.map((keyword) => {
                    const isActive = search.trim() === keyword || debouncedSearch.trim() === keyword;
                    return (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => applySearchShortcut(keyword)}
                        className={`min-h-[44px] rounded-full border px-3 py-2 transition-colors cursor-pointer ${
                          isActive
                            ? accentSoftClass
                            : 'border-gray-200 bg-white text-gray-500 hover:border-brand/30 hover:text-brand'
                        }`}
                      >
                        {keyword}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">{currentBoardGuide.genreLabel}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setGenre('')}
                    aria-pressed={genre === ''}
                    className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                      genre === ''
                        ? accentSoftSolidClass
                        : 'border border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand'
                    }`}
                  >
                    全部
                  </button>
                  {SITE_CONFIG.genres.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGenre(genre === g.key ? '' : g.key)}
                      aria-pressed={genre === g.key}
                      className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                        genre === g.key ? 'text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand'
                      }`}
                      style={genre === g.key ? { backgroundColor: g.color } : undefined}
                    >
                      {g.icon} {g.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">{currentBoardGuide.playTypeLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {availablePlayTypes.map((pt) => (
                    <button
                      key={pt.key}
                      type="button"
                      onClick={() => setPlayType(playType === pt.key ? '' : pt.key)}
                      aria-pressed={playType === pt.key}
                      className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                        playType === pt.key
                          ? accentSoftSolidClass
                          : 'border border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand'
                      }`}
                    >
                      {pt.icon} {getPlayTypeDisplayName(pt.key, board, pt.name)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="ui-btn ui-btn-secondary rounded-2xl px-4 py-3 text-sm"
                >
                  {currentBoardGuide.resetLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(false)}
                  className={`ui-btn rounded-2xl px-4 py-3 text-sm ${activeBoardKey === 'character' ? 'ui-btn-primary-character' : 'ui-btn-primary-adventure'}`}
                >
                  看看结果
                </button>
              </div>

            </div>
          </div>
        </>
      )}

      <div className="fixed bottom-[calc(5.55rem+env(safe-area-inset-bottom))] right-4 z-30 lg:hidden">
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 p-2 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.28)] backdrop-blur-xl">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:border-brand hover:text-brand"
            >
              {STATUS_COPY.reset}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowMobileFilters(true)}
            className={`inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors ${showMobileFilters ? accentSoftSolidClass : 'border border-gray-200 bg-white text-gray-700 hover:border-brand hover:text-brand'}`}
          >
            {activeFilterCount > 0 ? `筛选 ${activeFilterCount}` : '筛选'}
          </button>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_17.5rem] 2xl:grid-cols-[minmax(0,1fr)_18rem]">
        <aside className="hidden lg:order-2 lg:block">
          <div className="sticky top-20">
            <div className="ui-panel p-4">
              {activeFilterPills.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] text-gray-400">已选</p>
                  <div className="mt-3">{renderActiveFilterPills()}</div>
                </div>
              ) : null}

              <div>
                <p className={`text-xs font-semibold tracking-[0.18em] ${activeFilterPills.length > 0 ? 'mt-5' : ''} text-gray-400`}>{currentBoardGuide.genreLabel}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setGenre('')}
                    aria-pressed={genre === ''}
                    className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                      genre === ''
                        ? accentSoftSolidClass
                        : 'border border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand'
                    }`}
                  >
                    全部
                  </button>
                  {SITE_CONFIG.genres.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setGenre(genre === g.key ? '' : g.key)}
                      aria-pressed={genre === g.key}
                      className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                        genre === g.key ? 'text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand'
                      }`}
                      style={genre === g.key ? { backgroundColor: g.color } : undefined}
                    >
                      {g.icon} {g.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-gray-400">{currentBoardGuide.playTypeLabel}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {availablePlayTypes.map((pt) => (
                    <button
                      key={pt.key}
                      type="button"
                      onClick={() => setPlayType(playType === pt.key ? '' : pt.key)}
                      aria-pressed={playType === pt.key}
                      className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                        playType === pt.key
                          ? accentSoftSolidClass
                          : 'border border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand'
                      }`}
                    >
                      {pt.icon} {getPlayTypeDisplayName(pt.key, board, pt.name)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold tracking-[0.18em] text-gray-400">{currentBoardGuide.sortLabel}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SORT_OPTIONS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSort(s.key)}
                      aria-pressed={sort === s.key}
                      className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                        sort === s.key
                          ? accentSoftSolidClass
                          : 'border border-gray-200 bg-white text-gray-500 hover:border-brand hover:text-brand'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="ui-btn ui-btn-secondary mt-5 w-full rounded-full px-4 py-2.5 text-sm"
                >
                  {currentBoardGuide.resetLabel}
                </button>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0 lg:order-1">
          {isCharacterBoard && !error && (loading || worlds.length > 0) ? renderCharacterListDivider() : null}

          <div className={`${isCharacterBoard ? 'mb-4' : 'mb-5'} flex flex-col gap-1 text-sm`}>
            <p className={`font-medium ${isCharacterBoard ? 'text-rose-600' : isAdventureBoard ? 'text-brand' : 'text-gray-600'}`}>
              {loading && worlds.length === 0
                ? currentBoardGuide.loadingText
                : worlds.length > 0
                  ? currentBoardGuide.resultCountLabel(total)
                  : hasActiveFilters
                    ? currentBoardGuide.filteredEmptyText
                    : isPlatformEmpty
                      ? platformEmptyLead
                      : currentBoardGuide.idleText}
            </p>
            {showInlineRefreshHint && (
              <p className={`text-xs leading-5 ${isCharacterBoard ? 'text-rose-400' : isAdventureBoard ? 'text-brand/70' : 'text-gray-400'}`}>
                {STATUS_COPY.loading.default}
              </p>
            )}
          </div>

          {showLoadingSkeleton && (
            <div className={resultGridClass}>
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div
                  key={i}
                  className={`${isCharacterBoard ? 'h-40 rounded-[1.75rem] bg-rose-100/70 sm:h-72' : isAdventureBoard ? 'h-40 rounded-[1.75rem] bg-brand-100/70 sm:h-72' : 'h-40 rounded-[1.75rem] bg-gray-100 sm:h-72'} animate-pulse`}
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="ui-panel flex flex-col items-center py-16 text-gray-400">
              <svg className="mb-4 h-16 w-16 opacity-40 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="px-4 text-center text-base text-gray-500">{error}</p>
              <button
                onClick={() => fetchWorlds(1, false)}
                className="ui-btn ui-btn-primary mt-4 rounded-full px-6 py-2 text-sm"
              >
                {STATUS_COPY.retry}
              </button>
            </div>
          )}

          {!loading && !error && worlds.length === 0 && (
            <div className="ui-panel flex flex-col items-center py-16 text-gray-400">
              <svg className="mb-4 h-16 w-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <p className="max-w-md px-4 text-center text-base text-gray-600">
                {isPlatformEmpty ? platformEmptyTitle : currentBoardGuide.emptyTitle}
              </p>
              <p className="mt-2 max-w-md px-4 text-center text-sm text-gray-400">
                {isPlatformEmpty ? platformEmptyDescription : currentBoardGuide.emptyDescription}
              </p>
              {!isPlatformEmpty && (trimmedSearch || emptySuggestionKeywords.length > 0 || otherBoardShortcut) && (
                <div className={`mt-4 w-full max-w-2xl rounded-2xl border px-4 py-4 text-left ${
                  isCharacterBoard
                    ? 'border-rose-100 bg-rose-50/70'
                    : isAdventureBoard
                      ? 'border-brand/10 bg-brand-50/70'
                      : 'border-gray-100 bg-gray-50'
                }`}>
                  <p className="text-sm font-semibold text-gray-900">
                    {trimmedSearch ? STATUS_COPY.empty.explore : STATUS_COPY.empty.default}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {trimmedSearch
                      ? '可以缩短关键词，或先重置部分筛选条件。'
                      : '可以更换关键词，或切换分区继续查看。'}
                  </p>
                  {emptySuggestionKeywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {emptySuggestionKeywords.map((keyword) => (
                        <button
                          key={keyword}
                          type="button"
                          onClick={() => applySearchShortcut(keyword)}
                          className={`min-h-[44px] rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${accentSoftClass}`}
                        >
                          试试 {keyword}
                        </button>
                      ))}
                    </div>
                  )}
                  {otherBoardShortcut && (
                    <Link
                      href={otherBoardShortcut.href}
                      className="mt-3 inline-flex text-xs font-semibold text-brand hover:underline"
                    >
                      {otherBoardShortcut.label} →
                    </Link>
                  )}
                </div>
              )}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                {isPlatformEmpty ? (
                  <>
                    <button
                      type="button"
                      onClick={() => fetchWorlds(1, false)}
                      className="ui-btn ui-btn-primary rounded-full px-5 py-2.5 text-sm"
                    >
                      {STATUS_COPY.retry}
                    </button>
                    <Link
                      href="/"
                      className="ui-btn ui-btn-secondary rounded-full px-5 py-2.5 text-sm"
                    >
                      {STATUS_COPY.back}
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="ui-btn ui-btn-primary rounded-full px-5 py-2.5 text-sm"
                    >
                      {currentBoardGuide.resetLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(currentBoardGuide.popularHref)}
                      className="ui-btn ui-btn-secondary rounded-full px-5 py-2.5 text-sm"
                    >
                      {currentBoardGuide.popularLabel}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {!error && worlds.length > 0 && (
            <>
              <div className={resultGridClass}>
                {worlds.map((world) => (
                  <WorldCard
                    key={world.id}
                    world={world}
                    variant={cardVariant}
                    isAuthenticated={isAuthenticated}
                    actionLabel={isCharacterBoard ? '先看看' : '查看详情'}
                    onAction={isCharacterBoard ? openCharacterPreview : undefined}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore || loading}
                    className="ui-btn ui-btn-secondary rounded-full px-8 py-2.5 text-sm disabled:opacity-50"
                  >
                    {loading || loadingMore ? STATUS_COPY.loading.default : currentBoardGuide.loadMoreLabel}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CharacterModal
        character={previewCharacter}
        actionLabel={previewActionLabel}
        actionClassName="ui-btn-primary-character"
        secondaryActionLabel={previewLoading ? '补全更多设定中…' : '查看详情'}
        contextLine={previewWorld ? `来自《${previewWorld.title}》` : undefined}
        onClose={closePreview}
        onAction={handlePreviewStart}
        onSecondaryAction={previewLoading ? undefined : handlePreviewOpenWorld}
      />
    </div>
  );
}

export default function ExplorePage({ initialState }: ExplorePageProps) {
  return (
    <Suspense
      fallback={(
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-gray-400">{STATUS_COPY.loading.explore}</div>
        </div>
      )}
    >
      <ExploreContent initialState={initialState} />
    </Suspense>
  );
}
