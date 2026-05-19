'use client';

import { memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_CONFIG } from '@/config/site';
import { formatCount, getDisplayInitial, truncateText } from '@/lib/utils';

export interface WorldCharacterPreview {
  id?: string;
  name: string;
  avatarUrl?: string;
}

export interface WorldData {
  id: string;
  title: string;
  genre: string;
  playType?: string;
  description: string;
  playCount: number;
  likeCount: number;
  cover: string;
  creatorName?: string;
  primaryCharacterName?: string;
  primaryCharacterGreeting?: string;
  primaryCharacterPersonality?: string;
  characterCount?: number;
  characters?: WorldCharacterPreview[];
  tags?: string[];
  opening?: string;
  avgRating?: number;
}

const GENRE_GRADIENTS = SITE_CONFIG.genreGradients;

type WorldCardVariant = 'default' | 'adventure' | 'character';

interface WorldCardProps {
  world: WorldData;
  variant?: WorldCardVariant;
  isAuthenticated?: boolean;
  actionLabel?: string;
  onAction?: (world: WorldData) => void;
}

function getGenre(key: string) {
  return SITE_CONFIG.genres.find((genre) => genre.key === key);
}

function getPreviewText(text: string, maxLength: number) {
  const normalized = text.trim();
  if (!normalized) return '';
  const truncated = truncateText(normalized, maxLength).trim();
  return truncated && truncated !== normalized ? `${truncated}…` : truncated;
}

function stripWrappedQuotes(value: string) {
  return value
    .trim()
    .replace(/^“|”$/g, '')
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

function formatHook(text: string, maxLength: number, quoted = false) {
  const preview = getPreviewText(quoted ? stripWrappedQuotes(text) : text, maxLength);
  if (!preview) return '';
  return quoted ? `“${preview}”` : preview;
}

function getInteractionTone(playTypeKey?: string) {
  switch (playTypeKey) {
    case 'romance':
      return { label: '恋爱' };
    case 'companion':
      return { label: '陪伴' };
    case 'role_play':
      return { label: '代入角色' };
    default:
      return { label: '角色互动' };
  }
}

function getProofText(world: WorldData, characterCount: number, avgRating: number | null) {
  if (world.playCount > 0) return `${formatCount(world.playCount)} 次开局`;
  if (world.likeCount > 0) return `${formatCount(world.likeCount)} 人收藏`;
  if (avgRating !== null) return `${avgRating.toFixed(1)} 分口碑`;
  if (characterCount > 0) return `${characterCount} 位角色`;
  return '';
}

export const WorldCard = memo(function WorldCard({
  world,
  variant = 'default',
  actionLabel: actionLabelProp,
  onAction,
}: WorldCardProps) {
  const genre = getGenre(world.genre);
  const playType = world.playType ? SITE_CONFIG.playTypes.find((item) => item.key === world.playType) : undefined;
  const isAdventureCard = variant === 'adventure';
  const isCharacterCard = variant === 'character';
  const primaryCharacterName = world.primaryCharacterName?.trim() || '';
  const primaryCharacterGreeting = world.primaryCharacterGreeting?.trim() || '';
  const primaryCharacterPersonality = world.primaryCharacterPersonality?.trim() || '';
  const openingText = world.opening?.trim() || '';
  const descriptionText = world.description?.trim() || '';
  const characterCount = typeof world.characterCount === 'number' && Number.isFinite(world.characterCount)
    ? world.characterCount
    : Array.isArray(world.characters)
      ? world.characters.length
      : 0;
  const avgRating = typeof world.avgRating === 'number' && Number.isFinite(world.avgRating) && world.avgRating > 0
    ? world.avgRating
    : null;
  const interactionTone = getInteractionTone(playType?.key);
  const matchedCharacterWithAvatar = Array.isArray(world.characters)
    ? world.characters.find((character) => {
        const avatarUrl = character.avatarUrl?.trim() || '';
        const name = character.name?.trim() || '';
        return avatarUrl && (!primaryCharacterName || name === primaryCharacterName);
      }) || world.characters.find((character) => Boolean(character.avatarUrl?.trim()))
    : undefined;
  const characterAvatarUrl = matchedCharacterWithAvatar?.avatarUrl?.trim() || '';
  const mediaImageUrl = isCharacterCard ? characterAvatarUrl || world.cover.trim() : world.cover.trim();
  const gradient = GENRE_GRADIENTS[world.genre] || 'from-slate-600 to-slate-400';
  const detailHref = `/world/${world.id}`;
  const proofText = getProofText(world, characterCount, avgRating);
  const titleText = isCharacterCard ? primaryCharacterName || world.title : world.title;
  const badgeText = isCharacterCard
    ? `${playType?.icon || '💕'} ${interactionTone.label}`
    : playType && playType.key !== 'world'
      ? `${playType.icon} ${playType.name}`
      : genre
        ? `${genre.icon} ${genre.name}`
        : '📖 故事';
  const metaPrimary = isCharacterCard
    ? world.title && primaryCharacterName
      ? `来自《${world.title}》`
      : world.title
    : genre?.name || playType?.name || '互动故事';
  const metaSecondary = proofText || (isCharacterCard ? interactionTone.label : '');
  const metaText = [metaPrimary, metaSecondary].filter(Boolean).join(' · ');
  const hookText = isCharacterCard
    ? formatHook(primaryCharacterGreeting, 24, true)
      || formatHook(openingText, 24, true)
      || formatHook(primaryCharacterPersonality, 28)
      || formatHook(descriptionText, 30)
      || '先听 TA 开口。'
    : isAdventureCard
      ? formatHook(openingText, 20, true)
        || formatHook(descriptionText, 20)
        || formatHook(primaryCharacterGreeting, 20, true)
        || '这局看着就有戏。'
      : formatHook(openingText, 28, true)
        || formatHook(descriptionText, 32)
        || formatHook(primaryCharacterGreeting, 24, true)
        || formatHook(primaryCharacterPersonality, 28)
        || '先看一眼，再决定要不要点开。';
  const bodySummaryText = isCharacterCard
    ? getPreviewText(descriptionText, 34)
      || getPreviewText(primaryCharacterPersonality, 32)
      || getPreviewText(openingText, 36)
      || '先看看 TA 的相处气味，再决定要不要点进去。'
    : isAdventureCard
      ? getPreviewText(descriptionText, 60)
        || getPreviewText(openingText, 60)
        || getPreviewText(primaryCharacterGreeting, 48)
        || '先看看这个世界是什么，再决定要不要进场。'
      : getPreviewText(descriptionText, 40)
        || getPreviewText(openingText, 44)
        || getPreviewText(primaryCharacterGreeting, 28)
        || getPreviewText(primaryCharacterPersonality, 32)
        || '先看清这段故事的入口，再决定要不要点开。';
  const cardAccentClass = isCharacterCard
    ? 'border-rose-100/90 shadow-[0_22px_58px_-40px_rgba(244,114,182,0.48)] hover:shadow-[0_30px_72px_-40px_rgba(244,114,182,0.55)]'
    : isAdventureCard
      ? 'border-brand/15 shadow-[0_22px_58px_-40px_rgba(59,130,196,0.38)] hover:shadow-[0_30px_72px_-40px_rgba(59,130,196,0.46)]'
      : 'border-gray-200/80 shadow-[0_18px_48px_-38px_rgba(15,23,42,0.26)] hover:shadow-[0_26px_64px_-38px_rgba(15,23,42,0.32)]';
  const badgeClass = isCharacterCard ? 'bg-rose-500/92' : isAdventureCard ? 'bg-brand/90' : 'bg-slate-950/72';
  const mediaAspectClass = isCharacterCard
    ? 'aspect-[3/4]'
    : isAdventureCard
      ? 'aspect-[16/9] sm:aspect-[2/1]'
      : 'aspect-[4/5] sm:aspect-[3/4]';
  const mediaImageClass = isCharacterCard
    ? 'object-cover object-top transition-transform duration-700 group-hover:scale-105'
    : 'object-cover object-center transition-transform duration-700 group-hover:scale-105';
  const actionLabel = actionLabelProp || '查看详情';
  const adventureActionLabel = actionLabel === '查看详情' ? '查看详情 →' : actionLabel;
  const titleClassName = isAdventureCard
    ? 'line-clamp-2 text-[1.05rem] font-bold leading-snug text-gray-950'
    : 'line-clamp-2 text-[1.2rem] font-black leading-7 tracking-tight text-gray-950 sm:text-[1.35rem] sm:leading-8';
  const summaryClassName = isAdventureCard
    ? 'mt-2.5 line-clamp-3 text-[13px] leading-5 text-gray-500 sm:text-sm sm:leading-6'
    : 'mt-2.5 line-clamp-2 text-[13px] leading-5 text-gray-500 sm:text-sm sm:leading-6';

  return (
    <article className={`group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.6rem] border bg-white transition-all duration-300 hover:-translate-y-1 ${cardAccentClass}`}>
      <div className="p-3 pb-0">
        <div className={`relative overflow-hidden rounded-[1.35rem] bg-gradient-to-br ${gradient} ${mediaAspectClass}`}>
          {mediaImageUrl ? (
            <Image
              src={mediaImageUrl}
              alt={isCharacterCard ? `${primaryCharacterName || world.title} 的角色图` : `${world.title} 的封面图`}
              fill
              sizes="(max-width: 639px) 100vw, (max-width: 1024px) 50vw, (max-width: 1536px) 33vw, 25vw"
              className={mediaImageClass}
              loading="lazy"
              decoding="async"
              unoptimized
            />
          ) : isCharacterCard ? (
            <span className="flex h-full w-full items-center justify-center text-6xl font-black text-white/90 backdrop-blur-sm sm:text-7xl">
              {getDisplayInitial(primaryCharacterName || world.title, '角')}
            </span>
          ) : isAdventureCard ? (
            <span className="flex h-full w-full items-center justify-center text-6xl font-black text-white/90 backdrop-blur-sm sm:text-7xl">
              {genre?.icon || getDisplayInitial(world.title, '世')}
            </span>
          ) : (
            <span className="flex h-full w-full items-center justify-center text-6xl opacity-90 sm:text-7xl">
              {genre?.icon || '📖'}
            </span>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/86 via-slate-950/18 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.18),_transparent_36%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.12),_transparent_32%)]" />

          <div className="absolute left-4 top-4 right-4">
            <span className={`inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm ${badgeClass}`}>
              <span className="truncate">{badgeText}</span>
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 pt-16 text-white sm:p-5 sm:pt-20">
            <p className="max-w-[84%] line-clamp-2 text-[1rem] font-semibold leading-6 tracking-tight text-white sm:text-[1.12rem] sm:leading-7">
              {hookText}
            </p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[11.5rem] flex-1 flex-col px-4 pb-4 pt-3.5 sm:min-h-[12rem] sm:px-5 sm:pb-5 sm:pt-4">
        <h3 className={titleClassName}>
          {titleText}
        </h3>

        {isAdventureCard ? (
          <>
            {(genre || (playType && playType.key !== 'world')) ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {genre ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/8 px-2.5 py-1 text-[11px] font-medium text-brand">
                    {genre.icon} {genre.name}
                  </span>
                ) : null}
                {playType && playType.key !== 'world' ? (
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                    {playType.name}
                  </span>
                ) : null}
              </div>
            ) : null}

            <p className={summaryClassName}>
              {bodySummaryText}
            </p>

            <div className="mt-auto flex items-center justify-between pt-3">
              {proofText ? (
                <span className="text-xs text-gray-400">{proofText}</span>
              ) : null}
              {onAction ? (
                <button
                  type="button"
                  onClick={() => onAction(world)}
                  aria-label={`查看预览：${world.title}${primaryCharacterName ? `，主互动角色 ${primaryCharacterName}` : ''}`}
                  className="ml-auto inline-flex items-center text-sm font-semibold text-brand transition-colors hover:text-brand-dark cursor-pointer"
                >
                  {adventureActionLabel}
                </button>
              ) : (
                <Link
                  href={detailHref}
                  aria-label={`查看详情：${world.title}${primaryCharacterName ? `，主互动角色 ${primaryCharacterName}` : ''}`}
                  className="ml-auto inline-flex items-center text-sm font-semibold text-brand transition-colors hover:text-brand-dark"
                >
                  {adventureActionLabel}
                </Link>
              )}
            </div>
          </>
        ) : (
          <>
            {metaText ? (
              <p className="mt-1.5 line-clamp-1 text-xs text-gray-400 sm:text-[13px]">
                {metaText}
              </p>
            ) : null}
            <p className={summaryClassName}>
              {bodySummaryText}
            </p>

            <div className="mt-auto pt-3.5">
              {onAction ? (
                <button
                  type="button"
                  onClick={() => onAction(world)}
                  aria-label={`查看预览：${world.title}${primaryCharacterName ? `，主互动角色 ${primaryCharacterName}` : ''}`}
                  className="inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand"
                >
                  {actionLabel}
                </button>
              ) : (
                <Link
                  href={detailHref}
                  aria-label={`查看详情：${world.title}${primaryCharacterName ? `，主互动角色 ${primaryCharacterName}` : ''}`}
                  className="inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand"
                >
                  {actionLabel}
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
});
