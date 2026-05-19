'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorldCard } from '@/components/WorldCard';
import type { WorldData } from '@/components/WorldCard';
import { worldsAPI } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCount, normalizeWorlds } from '@/lib/utils';

/* ── Helpers ──────────────────────────────────────────── */

interface MyWorld extends WorldData {
  status: 'published' | 'draft' | 'archived';
}

const STATUS_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'published', label: '已发布' },
  { key: 'draft', label: '草稿' },
  { key: 'archived', label: '已下架' },
] as const;

/* ── Page ──────────────────────────────────────────────── */

export default function WorkshopPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<'worlds' | 'stats'>('worlds');
  const [worlds, setWorlds] = useState<MyWorld[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState('');
  const actionToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]['key']>('all');

  useEffect(() => {
    return () => {
      if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    };
  }, []);

  const fetchWorlds = useCallback(async (signal?: AbortSignal) => {
    setFetchError('');
    try {
      const res = await worldsAPI.list({ creator: 'me' }, signal ? { signal } : undefined);
      if (signal?.aborted) return;
      const rawList = ((res.data?.worlds || res.worlds || []) as Record<string, unknown>[]);
      const normalized = normalizeWorlds(rawList);
      const list = normalized.map((world, index) => ({
        ...world,
        status: ((rawList[index]?.status as MyWorld['status']) || 'published'),
      }));
      setWorlds(list);
    } catch (err: unknown) {
      if (signal?.aborted) return;
      setFetchError(err instanceof Error ? err.message : '加载失败，请稍后重试');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      void fetchWorlds(controller.signal);
      return () => {
        controller.abort();
      };
    }
    if (!authLoading) {
      setWorlds([]);
      setFetchError('');
      setLoading(false);
    }
  }, [user, authLoading, fetchWorlds]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/auth?redirect=${encodeURIComponent('/workshop')}`);
    }
  }, [authLoading, user, router]);

  const showActionToast = (msg: string) => {
    setActionToast(msg);
    if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    actionToastTimerRef.current = setTimeout(() => setActionToast(''), 3200);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget;
    setDeleteTarget(null);
    setDeletingId(id);
    try {
      await worldsAPI.delete(id);
      setWorlds((prev) => prev.filter((w) => w.id !== id));
    } catch {
      showActionToast('删除失败，请重试');
    } finally {
      setDeletingId(null);
    }
  };

  const handleArchive = async (world: MyWorld) => {
    const nextStatus = world.status === 'archived' ? 'published' : 'archived';
    const label = nextStatus === 'archived' ? '下架' : '重新发布';
    if (!confirm(`确定${label}《${world.title}》？`)) return;
    setArchivingId(world.id);
    try {
      const resp = await worldsAPI.update(world.id, { status: nextStatus });
      const data = (resp.data || resp) as Record<string, unknown>;
      const closedActiveSessions = Number(data.closed_active_sessions || 0);
      setWorlds((prev) => prev.map((w) => w.id === world.id ? { ...w, status: nextStatus } : w));
      showActionToast(closedActiveSessions > 0 ? `${label}成功，已结束 ${closedActiveSessions} 个进行中的游玩` : `${label}成功`);
    } catch {
      showActionToast(`${label}失败，请重试`);
    } finally {
      setArchivingId(null);
    }
  };

  const totalPlays = worlds.reduce((s, w) => s + w.playCount, 0);
  const totalLikes = worlds.reduce((s, w) => s + w.likeCount, 0);
  const averagePlays = worlds.length > 0 ? Math.round((totalPlays / worlds.length) * 10) / 10 : 0;
  const averageLikes = worlds.length > 0 ? Math.round((totalLikes / worlds.length) * 10) / 10 : 0;
  const statusStats = [
    { key: 'published', label: '已发布', value: worlds.filter((world) => world.status === 'published').length, tone: 'text-brand bg-brand/10' },
    { key: 'draft', label: '草稿', value: worlds.filter((world) => world.status === 'draft').length, tone: 'text-amber-700 bg-amber-50' },
    { key: 'archived', label: '已下架', value: worlds.filter((world) => world.status === 'archived').length, tone: 'text-gray-600 bg-gray-100' },
  ] as const;
  const genreStats = Object.entries(
    worlds.reduce<Record<string, number>>((acc, world) => {
      const key = world.genre || '未分类';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxGenreCount = genreStats[0]?.[1] || 1;
  const topWorlds = [...worlds]
    .sort((a, b) => b.playCount - a.playCount || b.likeCount - a.likeCount)
    .slice(0, 5);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredWorlds = useMemo(() => {
    return worlds.filter((world) => {
      const matchStatus = statusFilter === 'all' || world.status === statusFilter;
      const matchSearch = !normalizedSearch || (world.title || '').toLowerCase().includes(normalizedSearch);
      return matchStatus && matchSearch;
    });
  }, [worlds, statusFilter, normalizedSearch]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center text-sm text-gray-500">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
          <p className="mt-4">{authLoading ? '正在验证登录状态...' : '正在跳转到登录页...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6 xl:px-8 relative">
      {actionToast && (
        <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-red-500 px-4 py-2 text-sm text-white shadow-lg">
          {actionToast}
        </div>
      )}

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
          <span className="inline-flex w-fit rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
            Demo / 内测
          </span>
          <div>
            <p className="text-sm font-semibold text-amber-900">创作工坊还在 Demo / 内测阶段</p>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              现在先开放设定整理、草稿保存与基础发布；更完整的封面、作者主页与运营能力会继续补齐。
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">创作工坊 Demo / 内测</h1>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            上面是创作流程入口；下方“作品管理 / 数据概览”负责你已经创建的内容和基础数据。
          </p>
        </div>
        <Link
          href="/workshop/create"
          className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          + 新建内测世界
        </Link>
      </div>

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-brand/10 bg-brand/5 px-4 py-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">创作流程</p>
          <p className="mt-2 text-sm font-semibold text-gray-900">先新建，再补设定与角色，最后决定是否发布到当前内测区。</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">适合把脑海里的世界先整理成一版可玩的草稿。</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
          <p className="text-xs font-semibold tracking-[0.18em] text-gray-500">创作管理</p>
          <p className="mt-2 text-sm font-semibold text-gray-900">作品管理看草稿 / 发布 / 下架；数据概览只做轻量参考，不再和主创作流程混在一起。</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">先把内容做出来，再回来管理它，会更清楚。</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div role="tablist" className="flex gap-1 rounded-lg bg-gray-100 p-1 mb-8 max-w-sm">
        <button
          role="tab"
          aria-selected={tab === 'worlds'}
          onClick={() => setTab('worlds')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all cursor-pointer ${
            tab === 'worlds' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          作品管理
        </button>
        <button
          role="tab"
          aria-selected={tab === 'stats'}
          onClick={() => setTab('stats')}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all cursor-pointer ${
            tab === 'stats' ? 'bg-white text-brand shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          数据概览
        </button>
      </div>

      {/* 我的世界 Tab */}
      {tab === 'worlds' && (
        <>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <svg className="w-16 h-16 mb-4 opacity-40 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <p className="text-base text-gray-500">{fetchError}</p>
              <button
                onClick={() => { setLoading(true); fetchWorlds(); }}
                className="mt-4 rounded-full bg-brand px-6 py-2 text-sm font-medium text-white hover:bg-brand/90 transition-all cursor-pointer"
              >
                重试
              </button>
            </div>
          ) : worlds.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-gray-400">
              <svg className="w-16 h-16 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-base">还没有创建世界，先做一个内测版本试试吧</p>
              <Link
                href="/workshop/create"
                className="mt-4 rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
              >
                新建第一个内测世界
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">快速定位你的世界</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      支持按标题搜索和按状态筛选；已发布作品也可以直接跳去探索页确认是否已对外可见。
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {filteredWorlds.length === worlds.length ? `共 ${worlds.length} 个世界` : `已筛出 ${filteredWorlds.length} / ${worlds.length} 个世界`}
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="按世界名称搜索"
                      className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-700 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_FILTERS.map((filter) => {
                      const count = filter.key === 'all'
                        ? worlds.length
                        : worlds.filter((world) => world.status === filter.key).length;
                      const active = statusFilter === filter.key;
                      return (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={() => setStatusFilter(filter.key)}
                          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
                            active
                              ? 'bg-brand text-white shadow-sm'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {filter.label} · {count}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {filteredWorlds.length === 0 ? (
                <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-gray-400 shadow-sm">
                  <svg className="mb-4 h-14 w-14 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.25 5.25a7.5 7.5 0 0011.4 11.4z" />
                  </svg>
                  <p className="text-base text-gray-600">当前筛选下没有找到世界</p>
                  <p className="mt-1 text-sm text-gray-400">试试清空标题关键词，或切换到其他状态看看。</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                    className="mt-4 rounded-full bg-brand px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark cursor-pointer"
                  >
                    清空筛选
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredWorlds.map((world) => (
                    <div key={world.id} className="flex h-full flex-col space-y-3">
                      <div className="relative">
                        <WorldCard world={world} isAuthenticated={Boolean(user)} />
                        <span
                          className={`absolute top-3 right-3 z-10 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            world.status === 'published'
                              ? 'bg-green-100 text-green-700'
                              : world.status === 'archived'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {world.status === 'published' ? '已发布' : world.status === 'archived' ? '已下架' : '草稿'}
                        </span>
                      </div>
                      <div className="mt-auto space-y-2 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
                        {world.status === 'published' && (
                          <Link
                            href={`/explore?q=${encodeURIComponent(world.title)}`}
                            className="inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50/70 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            去探索页查看
                          </Link>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <Link
                            href={`/workshop/create?edit=${world.id}`}
                            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-brand/15 bg-white px-4 py-3 text-sm font-medium text-brand shadow-sm transition-colors hover:bg-brand hover:text-white"
                          >
                            编辑
                          </Link>
                          <button
                            onClick={() => handleArchive(world)}
                            disabled={archivingId === world.id}
                            className={`inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-4 py-3 text-sm font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-60 ${
                              world.status === 'archived'
                                ? 'border-emerald-100 text-emerald-600 hover:bg-emerald-50'
                                : 'border-amber-100 text-amber-600 hover:bg-amber-50'
                            }`}
                          >
                            {archivingId === world.id ? '处理中...' : world.status === 'archived' ? '重新发布' : '下架'}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(world.id)}
                            disabled={deletingId === world.id}
                            className="col-span-2 inline-flex min-h-9 items-center justify-center rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-medium text-red-400 shadow-sm transition-colors hover:bg-red-50 cursor-pointer disabled:opacity-60"
                          >
                            {deletingId === world.id ? '删除中...' : '永久删除'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* 数据统计 Tab */}
      {tab === 'stats' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-brand">{formatCount(totalPlays)}</p>
              <p className="mt-1 text-sm text-gray-500">总游玩次数</p>
              <p className="mt-2 text-xs text-gray-400">平均每个世界 {averagePlays} 次</p>
            </div>
            <div className="rounded-xl bg-white shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-red-400">{formatCount(totalLikes)}</p>
              <p className="mt-1 text-sm text-gray-500">总收藏数</p>
              <p className="mt-2 text-xs text-gray-400">平均每个世界 {averageLikes} 次</p>
            </div>
            <div className="rounded-xl bg-white shadow-sm p-6 text-center">
              <p className="text-3xl font-bold text-emerald-500">{worlds.length}</p>
              <p className="mt-1 text-sm text-gray-500">创建世界数</p>
              <p className="mt-2 text-xs text-gray-400">发布 / 草稿 / 下架 一目了然</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl bg-white shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900">状态分布</h3>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {statusStats.map((item) => (
                  <div key={item.key} className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${item.tone}`}>
                      {item.label}
                    </span>
                    <p className="mt-3 text-2xl font-bold text-gray-900">{item.value}</p>
                    <p className="mt-1 text-xs text-gray-400">{worlds.length > 0 ? `${Math.round((item.value / worlds.length) * 100)}%` : '0%'}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white shadow-sm p-6">
              <h3 className="text-base font-semibold text-gray-900">题材分布</h3>
              <div className="mt-4 space-y-3">
                {genreStats.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                    还没有可统计的世界题材。
                  </p>
                ) : (
                  genreStats.map(([genre, count]) => (
                    <div key={genre}>
                      <div className="mb-1 flex items-center justify-between text-sm text-gray-600">
                        <span>{genre}</span>
                        <span>{count} 个</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand to-brand-light"
                          style={{ width: `${Math.max(12, Math.round((count / maxGenreCount) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white shadow-sm p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900">表现最好的世界</h3>
              <span className="text-xs text-gray-400">按游玩次数优先，其次按收藏数排序</span>
            </div>
            {topWorlds.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
                还没有世界数据，先去创建你的第一个世界吧。
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {topWorlds.map((world, index) => (
                  <div key={world.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-sm font-bold text-brand">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{world.title}</p>
                        <p className="mt-0.5 text-xs text-gray-400">{world.genre || '未分类'} · {world.status === 'published' ? '已发布' : world.status === 'draft' ? '草稿' : '已下架'}</p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>游玩 {formatCount(world.playCount)}</p>
                      <p className="mt-0.5">收藏 {formatCount(world.likeCount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">确定删除？</h3>
            <p className="text-sm text-gray-500 mb-5">此操作不可撤销，世界及其所有数据将被永久删除。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
