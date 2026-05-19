'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { SITE_CONFIG } from '@/config/site';
import { StoryBranch } from './StoryBranch';
import type { StoryMessageData } from './StoryMessage';
import type { CharacterInfo, Relationships } from '@/types/play';
import { playAPI } from '@/lib/api';
import { toast } from '@/lib/toast';

interface SaveEntry {
  id: number;
  name: string;
  created_at: string;
}

interface RawMsg {
  role?: string;
  content?: string;
  narrative?: string;
  dialogues?: { character?: string; content?: string }[];
  choices?: string[];
  metadata?: string | Record<string, unknown>;
}

export type SideTab = 'characters' | 'log' | 'save' | 'branch';

export interface SidePanelProps {
  tab: SideTab;
  setTab: (t: SideTab) => void;
  messages: StoryMessageData[];
  characters: CharacterInfo[];
  sessionId: number;
  relationships: Relationships;
  relationshipsIsEstimated?: boolean;
  rawMessages: RawMsg[];
  onBranchNodeClick?: (messageIndex: number) => void;
  onSessionRefresh?: () => Promise<void> | void;
  onSaveLoaded?: () => void;
}

export function SidePanel({
  tab,
  setTab,
  messages,
  characters,
  sessionId,
  relationships,
  relationshipsIsEstimated,
  rawMessages,
  onBranchNodeClick,
  onSessionRefresh,
  onSaveLoaded,
}: SidePanelProps) {
  const [saves, setSaves] = useState<SaveEntry[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingSaveId, setLoadingSaveId] = useState<number | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingSaves, setLoadingSaves] = useState(false);
  const [saveListError, setSaveListError] = useState('');
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showSaveError = useCallback((message: string) => {
    toast.error(message);
  }, []);

  const fetchSaves = useCallback(async (
    signal?: AbortSignal,
    options?: { silent?: boolean; showError?: boolean },
  ) => {
    const { silent = false, showError = true } = options || {};
    if (!silent) setLoadingSaves(true);
    try {
      const resp = await playAPI.getSaves(sessionId, signal ? { signal } : undefined);
      if (signal?.aborted) return;
      const saves = resp.data || resp;
      setSaves(Array.isArray(saves) ? saves : []);
      setSaveListError('');
    } catch (err) {
      if (signal?.aborted) return;
      console.error('[SidePanel] fetchSaves failed:', err);
      const message = '书签页一时没翻开，再试一次。';
      setSaveListError(message);
      if (showError) showSaveError(message);
    } finally {
      if (!signal?.aborted && !silent) setLoadingSaves(false);
    }
  }, [sessionId, showSaveError]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchSaves(controller.signal, { silent: true, showError: false });
    return () => {
      controller.abort();
    };
  }, [fetchSaves]);

  useEffect(() => {
    if (tab !== 'save') return;
    const controller = new AbortController();
    void fetchSaves(controller.signal);
    return () => {
      controller.abort();
    };
  }, [tab, fetchSaves]);

  useEffect(() => {
    return () => {
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
    };
  }, []);

  const playerDecisionCount = messages.filter((msg) => msg.role === 'player').length;
  const narratorBeatCount = messages.filter((msg) => msg.role !== 'player').length;
  const saveNameRemaining = SITE_CONFIG.limits.play.saveNameMaxLength - saveName.length;
  const sideTabs = [
    { key: 'characters' as SideTab, label: '人物', count: characters.length, hint: '认人' },
    { key: 'log' as SideTab, label: '回看', count: messages.length, hint: '回顾' },
    { key: 'branch' as SideTab, label: '分支', count: playerDecisionCount, hint: '走过' },
    { key: 'save' as SideTab, label: '书签', count: saves.length, hint: '存档' },
  ] as const;

  const handleSave = async () => {
    if (!saveName.trim() || saving || loadingSaveId !== null) return;
    setSaving(true);
    try {
      await playAPI.save(sessionId, saveName.trim());
      setSaveName('');
      await fetchSaves(undefined, { silent: true, showError: false });
      setSaveSuccess(true);
      toast.success('这一刻已经替你夹成书签');
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => {
        saveSuccessTimerRef.current = null;
        setSaveSuccess(false);
      }, 2000);
    } catch {
      showSaveError('这枚书签还没夹稳，再试一次。');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadSave = async (saveId: number) => {
    if (loadingSaveId !== null || saving) return;
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm('要从这个书签接回吗？接回后，这之后的剧情会被新的走法改写。');
      if (!confirmed) return;
    }
    setLoadingSaveId(saveId);
    try {
      await playAPI.loadSave(sessionId, saveId);
      await onSessionRefresh?.();
      await fetchSaves(undefined, { silent: true, showError: false });
      onSaveLoaded?.();
      toast.success('已从这枚书签接回故事');
    } catch {
      showSaveError('这枚书签还没接上故事，再试一次。');
    } finally {
      setLoadingSaveId(null);
    }
  };

  return (
    <div className="relative flex h-full flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]">
      <div className="sticky top-0 z-10 border-b border-white/80 bg-white/90 px-3 pb-3 pt-3 backdrop-blur-sm sm:px-4">
        <div className="rounded-[24px] border border-brand/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92))] px-4 py-4 shadow-[0_16px_36px_-32px_rgba(59,130,196,0.65)]">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand/70">剧情手记</p>
          <p className="mt-2 text-sm leading-6 text-gray-700">
            人物、回看、分支和书签都收在这里，不会打断你继续读故事；需要时再翻一眼就够了。
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-500">
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-brand/10">在场 {characters.length} 位</span>
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-brand/10">你已开口 {playerDecisionCount} 次</span>
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-brand/10">剧情回应 {narratorBeatCount} 段</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          {sideTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex min-h-[58px] flex-col items-center justify-center rounded-2xl px-1 text-center transition-colors cursor-pointer ${
                tab === t.key
                  ? 'bg-brand/8 text-brand ring-1 ring-brand/10'
                  : 'bg-white/70 text-gray-400 ring-1 ring-gray-100 hover:text-gray-600'
              }`}
            >
              <span className="text-[11px] font-semibold tracking-[0.14em]">{t.label}</span>
              <span className={`mt-1 text-[10px] ${tab === t.key ? 'text-brand/70' : 'text-gray-300'}`}>
                {t.hint} · {t.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="space-y-4"
          >
            {tab === 'characters' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">这一幕里已经出场的人</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">先认清名字、气质和关系，再回去读故事会更容易抓住细节。</p>
                </div>
                {characters.map((c) => {
                  const rel = relationships[c.name];
                  return (
                    <div key={c.name} className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-gray-900">{c.name}</p>
                          {(c.role || c.status) && <p className="mt-1 text-xs text-gray-400">{c.role || c.status}</p>}
                        </div>
                        {relationshipsIsEstimated && rel && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] text-slate-400">关系为剧情估算</span>
                        )}
                      </div>

                      {(c.personality || c.desc) && (
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600">{c.personality || c.desc}</p>
                      )}

                      {rel && (
                        <div className="mt-4 space-y-2.5">
                          {([
                            { key: 'trust' as const, label: '信任', color: 'bg-emerald-400' },
                            { key: 'affection' as const, label: '好感', color: 'bg-pink-400' },
                            { key: 'hostility' as const, label: '敌意', color: 'bg-red-400' },
                            { key: 'fear' as const, label: '恐惧', color: 'bg-purple-400' },
                          ]).map((dim) => {
                            const val = rel[dim.key];
                            if (val === undefined || val === 0) return null;
                            return (
                              <div key={dim.key}>
                                <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
                                  <span>{dim.label}</span>
                                  <span>{val}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                                  <div
                                    className={`h-full rounded-full ${dim.color} transition-all`}
                                    style={{ width: `${val}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!rel && (c.affinity ?? 0) > 0 && (
                        <div className="mt-4">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
                            <span>好感</span>
                            <span>{c.affinity}%</span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-brand transition-all"
                              style={{ width: `${c.affinity}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {characters.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-4 py-8 text-center text-sm text-gray-400">
                    人物还没完全走到台前，再往下读几段，这里会慢慢热闹起来。
                  </div>
                )}
              </div>
            )}

            {tab === 'log' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">这条线刚刚发生过什么</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">像翻幕间提要一样快速回看；真要跳回某个节点，再去“走法”里点对应分支。</p>
                </div>
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-4 py-8 text-center text-sm text-gray-400">
                    故事刚开场，回看会在这里慢慢写满。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg, i) => {
                      const roleLabel = msg.role === 'player'
                        ? '你'
                        : msg.role === 'character'
                          ? (msg.characterName || '角色')
                          : '旁白';
                      const roleClass = msg.role === 'player'
                        ? 'bg-brand/10 text-brand'
                        : msg.role === 'character'
                          ? 'bg-violet-50 text-violet-600'
                          : 'bg-slate-100 text-slate-500';
                      const snippet = msg.content.length > 96 ? `${msg.content.slice(0, 96)}…` : msg.content;

                      return (
                        <div key={msg.messageKey || `${msg.role}-${i}-${msg.content}`} className="relative rounded-[24px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                          <div className="flex items-start justify-between gap-3">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${roleClass}`}>
                              {roleLabel}
                            </span>
                            <span className="text-[11px] text-gray-300">#{i + 1}</span>
                          </div>
                          <p className={`mt-3 whitespace-pre-wrap break-words text-sm leading-6 ${msg.role === 'player' ? 'text-gray-800' : 'text-gray-600'}`}>
                            {snippet}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'branch' && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">这是你亲自走出来的那条线</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">蓝色节点是你真的走过的选择，灰色是当时没有走上的岔路。点节点能跳回对应位置回看。</p>
                </div>
                <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                  <StoryBranch
                    messages={messages}
                    rawMessages={rawMessages}
                    onNodeClick={onBranchNodeClick}
                  />
                </div>
              </div>
            )}

            {tab === 'save' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900">先夹一枚书签，再大胆试分支</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">给这一刻取个像场景的名字，之后想回来改写，就能从这里重新接回。</p>
                </div>

                {saveListError && !loadingSaves && (
                  <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                    <p>{saveListError}</p>
                    <button
                      type="button"
                      onClick={() => { void fetchSaves(); }}
                      className="mt-3 inline-flex rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 cursor-pointer"
                    >
                      重新翻开书签页
                    </button>
                  </div>
                )}

                <div className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)]">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          void handleSave();
                        }
                      }}
                      placeholder="例如：桥上的沉默前 / 夜探开始前"
                      maxLength={SITE_CONFIG.limits.play.saveNameMaxLength}
                      className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-brand"
                    />
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || loadingSaveId !== null || !saveName.trim()}
                      className="min-h-[48px] w-full shrink-0 rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition-all hover:bg-brand-dark active:scale-[0.98] active:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer sm:w-auto"
                    >
                      {saveSuccess ? '已夹好 ✓' : saving ? '夹书签中...' : '夹住这一刻'}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-[11px] text-gray-400 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span>名字越像一个瞬间，回头就越容易一眼认出这段剧情。</span>
                    <span className={saveNameRemaining <= 10 ? 'text-amber-600' : ''}>{saveName.length}/{SITE_CONFIG.limits.play.saveNameMaxLength}</span>
                  </div>
                </div>

                {loadingSaves ? (
                  <p className="py-4 text-center text-sm text-gray-400">正在翻找你的书签…</p>
                ) : saves.length > 0 ? (
                  <div className="space-y-3">
                    {saves.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-[24px] border border-white/80 bg-white/90 p-4 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.35)] transition-colors hover:border-brand/20"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-gray-900">{s.name}</div>
                            <div className="mt-1 text-xs text-gray-400">
                              {new Date(s.created_at).toLocaleString('zh-CN')}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-gray-500">从这里接回后，这之后写下的剧情会被新的走法覆盖。</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleLoadSave(s.id)}
                            disabled={loadingSaveId !== null || saving}
                            className="min-h-[44px] w-full shrink-0 rounded-2xl border border-brand/15 bg-white px-3 py-2 text-xs font-medium text-brand transition-all hover:bg-brand/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer sm:w-auto"
                          >
                            {loadingSaveId === s.id ? '接回中...' : '从这里接回'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-200 bg-white/80 py-10 text-gray-400">
                    <svg className="mb-2 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <p className="text-sm">你还没在故事里落下书签</p>
                  </div>
                )}
              </div>
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
