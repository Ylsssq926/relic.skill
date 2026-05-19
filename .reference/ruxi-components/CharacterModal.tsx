'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { AnimatePresence, m } from 'framer-motion';
import { trapFocus } from '@/lib/a11y';
import { getDisplayInitial } from '@/lib/utils';

export const CHARACTER_ROLE_LABELS: Record<string, { label: string; color: string }> = {
  protagonist_template: { label: '主角模板', color: 'bg-brand/85 text-white' },
  npc: { label: 'NPC', color: 'bg-slate-900/72 text-white' },
  antagonist: { label: '反派', color: 'bg-red-500/85 text-white' },
  companion: { label: '同伴', color: 'bg-emerald-500/85 text-white' },
  player: { label: '玩家', color: 'bg-violet-500/85 text-white' },
};

export interface CharacterProfile extends Record<string, unknown> {
  id?: string | number;
  world_id?: string | number;
  name?: string | null;
  role?: string | null;
  avatar_url?: string | null;
  personality?: string | null;
  background?: string | null;
  appearance?: string | null;
  abilities?: string | null;
  speech_style?: string | null;
  greeting?: string | null;
  sort_order?: number | null;
  is_playable?: boolean | number | null;
  is_main_companion?: boolean | number | null;
}

interface CharacterModalProps {
  character: CharacterProfile | null;
  actionLabel?: string;
  actionClassName?: string;
  secondaryActionLabel?: string;
  contextLine?: string;
  onClose: () => void;
  onAction?: (character: CharacterProfile) => void;
  onSecondaryAction?: (character: CharacterProfile) => void;
}

function getRawText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function getText(value: string | null | undefined, fallback: string) {
  const normalized = getRawText(value);
  return normalized || fallback;
}

function pickFirstText(...values: Array<string | null | undefined>) {
  return values.map((value) => getRawText(value)).find(Boolean) || '';
}

export function CharacterModal({
  character,
  actionLabel,
  actionClassName,
  secondaryActionLabel,
  contextLine,
  onClose,
  onAction,
  onSecondaryAction,
}: CharacterModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!character) return;

    previousFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      trapFocus(dialogRef.current, event);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusedElementRef.current?.focus();
    };
  }, [character, onClose]);

  return (
    <AnimatePresence>
      {character && (() => {
        const roleMeta = CHARACTER_ROLE_LABELS[typeof character.role === 'string' ? character.role : ''] || CHARACTER_ROLE_LABELS.npc;
        const characterName = getText(character.name, '未命名角色');
        const personality = getText(character.personality, '先看这一眼，有感觉再往里走。');
        const background = getRawText(character.background);
        const appearance = getRawText(character.appearance);
        const abilities = getRawText(character.abilities);
        const speechStyle = getRawText(character.speech_style);
        const greeting = getRawText(character.greeting);
        const hasGreeting = Boolean(greeting);
        const avatarUrl = typeof character.avatar_url === 'string' ? character.avatar_url.trim() : '';
        const isPlayable = Boolean(character.is_playable);
        const isMainCompanion = Boolean(character.is_main_companion);
        const firstImpression = pickFirstText(appearance, personality, speechStyle) || personality;
        const detailText = pickFirstText(background, abilities, speechStyle) || '先记个轮廓。真进场了，TA 会自己露出更多。';
        const primaryActionLabel = actionLabel
          || (isPlayable
            ? `就用${characterName}进场`
            : isMainCompanion
              ? `去见见${characterName}`
              : `去碰见${characterName}`);
        const modalLead = hasGreeting
          ? '先听 TA 这一句。喜欢，再往前。'
          : isPlayable
            ? '先认认这个身份。顺手的话，就直接进去。'
            : '先认识一下这个人。对味，再继续。';
        const accentTag = isPlayable
          ? '可直接上身'
          : isMainCompanion
            ? '戏份很近'
            : '';
        const interactionHint = isPlayable
          ? `一开场，你就是 ${characterName}。`
          : isMainCompanion
            ? `${characterName} 很快就会和你对上戏。`
            : hasGreeting
              ? `${characterName} 多半会先这样来接你。`
              : `${characterName} 不会远，很快就会撞上。`;
        const highlightTitle = hasGreeting
          ? 'TA 多半先这么开口'
          : isPlayable
            ? '你会先借这层身份进场'
            : '先记住这个人';
        const highlightText = hasGreeting ? `“${greeting}”` : firstImpression;
        const metaCards = [
          {
            label: '这人在戏里',
            value: isPlayable
              ? '一开场你就是 TA'
              : isMainCompanion
                ? '很快会和你对上戏'
                : roleMeta.label,
          },
          {
            label: '你们怎么碰上',
            value: interactionHint,
          },
        ];
        const detailSections = [
          background ? { label: '来处', value: background } : null,
          appearance ? { label: '第一眼', value: appearance } : null,
          speechStyle ? { label: '说话味儿', value: speechStyle } : null,
          abilities ? { label: '能耐', value: abilities } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>;
        const modalId = `character-modal-${character.id ?? 'detail'}`;

        return (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end bg-black/55 backdrop-blur-sm sm:items-center sm:justify-center"
            onClick={(event) => event.target === event.currentTarget && onClose()}
          >
            <m.div
              ref={dialogRef}
              initial={{ opacity: 0, scale: 0.98, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 24 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${modalId}-title`}
              aria-describedby={`${modalId}-desc`}
              tabIndex={-1}
              className="mt-auto flex h-[88dvh] max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[30px] bg-white shadow-2xl sm:mx-auto sm:my-4 sm:h-auto sm:max-h-[88vh] sm:max-w-3xl sm:rounded-[28px]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand to-brand-light px-4 pb-5 pt-[calc(0.75rem+env(safe-area-inset-top))] text-white sm:px-8 sm:py-6">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.16),transparent_36%)]" />
                <div className="relative mb-3 flex justify-center sm:hidden">
                  <div className="h-1 w-10 rounded-full bg-white/40" />
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={onClose}
                  className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-10 rounded-2xl border border-white/15 bg-white/10 p-2.5 text-white/90 transition-colors hover:bg-white/15 hover:text-white sm:right-6 sm:top-6"
                  aria-label="关闭角色详情"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <div className="relative grid gap-5 sm:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] sm:items-end">
                  <div className="relative aspect-[5/4] overflow-hidden rounded-[24px] border border-white/15 bg-white/12 shadow-[0_22px_56px_-28px_rgba(15,23,42,0.45)] sm:aspect-[4/3] sm:rounded-[28px]">
                    {avatarUrl ? (
                      <Image
                        src={avatarUrl}
                        alt={`${characterName} 的角色图`}
                        fill
                        sizes="(max-width: 640px) 100vw, 360px"
                        className="object-cover object-top"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-6xl font-black text-white/90 sm:text-7xl">
                        {getDisplayInitial(characterName, '角')}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/72 via-slate-950/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="text-[11px] font-semibold tracking-[0.2em] text-white/75">先记住这一眼</p>
                      <p className="mt-2 text-2xl font-black tracking-tight drop-shadow-sm sm:text-[1.8rem]">{characterName}</p>
                      <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/82">{firstImpression}</p>
                    </div>
                  </div>
                  <div className="min-w-0 pt-1 sm:pb-2 sm:pr-10">
                    <p className="text-xs font-semibold tracking-[0.24em] text-white/82">先看看这个人</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <h2 id={`${modalId}-title`} className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                        {characterName}
                      </h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-white/15 ${roleMeta.color}`}>
                        {roleMeta.label}
                      </span>
                      {accentTag && accentTag !== roleMeta.label && (
                        <span className="rounded-full bg-white/14 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/15">
                          {accentTag}
                        </span>
                      )}
                    </div>
                    {contextLine ? (
                      <p className="mt-3 text-sm font-medium text-white/78">{contextLine}</p>
                    ) : null}
                    <p id={`${modalId}-desc`} className="mt-3 max-w-2xl whitespace-pre-wrap break-words text-sm leading-relaxed text-white/90">
                      {modalLead}
                    </p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-24 sm:px-8 sm:py-6 sm:pb-6">
                <div className="space-y-4">
                  <div className="rounded-[1.6rem] border border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.96))] p-4 shadow-sm shadow-slate-100/70">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">{highlightTitle}</p>
                    <p className={`mt-3 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-900 sm:text-base sm:leading-8 ${hasGreeting ? 'italic font-semibold' : 'font-semibold'}`}>
                      {highlightText}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {metaCards.map((card) => (
                      <div key={card.label} className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/70">
                        <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">{card.label}</p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7">{card.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-[1.6rem] border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100/70">
                    <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">再靠近一点</p>
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-gray-600 sm:text-[15px] sm:leading-8">
                      {detailText}
                    </p>
                  </div>

                  {detailSections.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {detailSections.map((section) => (
                        <div key={section.label} className="rounded-[1.4rem] border border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.86),rgba(255,255,255,0.96))] p-4 shadow-sm shadow-slate-100/70">
                          <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">{section.label}</p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 sm:text-[15px] sm:leading-7">{section.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 border-t border-gray-100 bg-white/95 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {onSecondaryAction ? (
                    <button
                      type="button"
                      onClick={() => onSecondaryAction(character)}
                      className="inline-flex min-h-[42px] items-center rounded-2xl px-1 py-2 text-sm font-semibold text-brand transition-colors hover:text-brand-dark"
                    >
                      {secondaryActionLabel || '查看详情'}
                    </button>
                  ) : <span className="hidden sm:block" />}
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => onAction?.(character)}
                      disabled={!onAction}
                      className={`ui-btn min-h-[52px] rounded-2xl px-5 py-3 text-base disabled:cursor-not-allowed disabled:opacity-50 ${actionClassName || 'ui-btn-primary-adventure'}`}
                      aria-label={onAction ? primaryActionLabel : undefined}
                    >
                      {primaryActionLabel}
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[44px] rounded-2xl px-4 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700 sm:border sm:border-gray-200 sm:bg-white sm:hover:border-brand sm:hover:text-brand"
                    >
                      再想想
                    </button>
                  </div>
                </div>
              </div>
            </m.div>
          </m.div>
        );
      })()}
    </AnimatePresence>
  );
}
