'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { m } from 'framer-motion';
import { parseAIResponse } from '@/app/play/[sessionId]/usePlaySession';
import { StoryMessage, type StoryMessageData } from '@/components/play/StoryMessage';
import { useAuth } from '@/lib/auth-context';
import { playAPI } from '@/lib/api';
import type { StoryMessage as ApiStoryMessage, WorldData } from '@/types/api';

const CHARACTER_PLAY_TYPES = new Set(['romance', 'companion', 'role_play']);

type SharedWorld = WorldData & {
  creator_name?: string | null;
  creator_nickname?: string | null;
  play_type?: string | null;
  playType?: string | null;
  play_count?: number | null;
  like_count?: number | null;
  avg_rating?: number | null;
  avgRating?: number | null;
  rating_count?: number | null;
  ratingCount?: number | null;
  character_count?: number | null;
  characterCount?: number | null;
};

interface SharedMessageItem {
  message: StoryMessageData;
  choices: string[];
  selectedChoice: string | null;
}

interface SharedSessionInfo {
  id?: number | null;
  status?: string | null;
  summary?: string | null;
  protagonist_name?: string | null;
  protagonistName?: string | null;
}

interface ShareLens {
  shareBadge: string;
  entryChip: string;
  experienceChip: string;
  encounterText: string;
  entryText: string;
  experienceText: string;
  startLabel: string;
  detailLabel: string;
  signedInBridge: string;
  guestBridge: string;
}

function getMessageContent(message: ApiStoryMessage): string {
  return message.content || message.text || '';
}

function extractChoices(message: ApiStoryMessage): string[] {
  if (Array.isArray(message.choices)) {
    return message.choices.filter(
      (choice): choice is string => typeof choice === 'string' && choice.trim().length > 0,
    );
  }

  if (!message.metadata) return [];

  try {
    const meta = typeof message.metadata === 'string' ? JSON.parse(message.metadata) : message.metadata;
    if (
      meta &&
      typeof meta === 'object' &&
      'choices' in meta &&
      Array.isArray((meta as { choices: unknown }).choices)
    ) {
      return (meta as { choices: unknown[] }).choices.filter(
        (choice): choice is string => typeof choice === 'string' && choice.trim().length > 0,
      );
    }
  } catch {
    // ignore invalid metadata JSON
  }

  return [];
}

function findNextPlayerChoice(messages: ApiStoryMessage[], currentIndex: number): string | null {
  for (let index = currentIndex + 1; index < messages.length; index += 1) {
    const next = messages[index];
    if (next.role === 'player' || next.role === 'user') {
      const content = getMessageContent(next).trim();
      return content || null;
    }
  }
  return null;
}

function convertBackendMessages(messages: ApiStoryMessage[]): SharedMessageItem[] {
  const items: SharedMessageItem[] = [];

  messages.forEach((message, index) => {
    if (message.role === 'player' || message.role === 'user') {
      items.push({
        message: {
          role: 'player',
          content: getMessageContent(message),
        },
        choices: [],
        selectedChoice: null,
      });
      return;
    }

    const parsed = parseAIResponse(message as Parameters<typeof parseAIResponse>[0]);
    const messageChoices = parsed.choices.length > 0 ? parsed.choices : extractChoices(message);
    const selectedChoice = messageChoices.length > 0 ? findNextPlayerChoice(messages, index) : null;

    if (parsed.messages.length === 0) {
      items.push({
        message: {
          role: message.role === 'character' ? 'character' : 'narrator',
          characterName: message.character_name,
          content: getMessageContent(message),
        },
        choices: messageChoices,
        selectedChoice,
      });
      return;
    }

    parsed.messages.forEach((parsedMessage, parsedIndex) => {
      items.push({
        message: parsedMessage,
        choices: parsedIndex === parsed.messages.length - 1 ? messageChoices : [],
        selectedChoice: parsedIndex === parsed.messages.length - 1 ? selectedChoice : null,
      });
    });
  });

  return items;
}

function getErrorCopy(error: string) {
  if (/过期/.test(error)) {
    return {
      title: '这个分享链接已过期',
      detail: '分享链接默认有效期为 30 天，如需继续查看，请让分享者重新生成链接。',
    };
  }

  if (/不存在|无效/.test(error)) {
    return {
      title: '这个分享链接无效或不存在',
      detail: '链接可能输入有误，或者原始分享已经失效。',
    };
  }

  return {
    title: '分享链接暂时无法打开',
    detail: '链接可能暂时不可用，请稍后再试。',
  };
}

function getPlayTypeKey(world: SharedWorld | null) {
  const raw = (world?.play_type || world?.playType || 'world').toString().trim();
  return raw || 'world';
}

function getPrimaryInteractionName(world: SharedWorld | null, messages: SharedMessageItem[]) {
  const worldPrimary = world?.primary_character_name?.trim();
  if (worldPrimary) return worldPrimary;

  const firstCharacterMessage = messages.find(
    (item) => item.message.role === 'character' && item.message.characterName?.trim(),
  );

  return firstCharacterMessage?.message.characterName?.trim() || '';
}

function getShareLens(playTypeKey: string, primaryInteractionName: string): ShareLens {
  switch (playTypeKey) {
    case 'romance':
      return {
        shareBadge: '这一条关系线',
        entryChip: '换你来接',
        experienceChip: '偏心动',
        encounterText: primaryInteractionName
          ? `先听 ${primaryInteractionName} 这一句，看看有没有感觉。`
          : '先听 TA 这一句，看看有没有感觉。',
        entryText: '换成你，会从同一个世界重开。带上名字，就能往下接。',
        experienceText: '偏心动、拉扯、慢慢靠近。',
        startLabel: primaryInteractionName ? `去见${primaryInteractionName}` : '开我的版本',
        detailLabel: '去门口看看',
        signedInBridge: primaryInteractionName
          ? `想亲自去见 ${primaryInteractionName}，现在就能开场。`
          : '想亲自接这条线，现在就能开场。',
        guestBridge: primaryInteractionName
          ? `想亲自去见 ${primaryInteractionName}，先登录，回来还在这儿。`
          : '想亲自接这条线，先登录，回来还在这儿。',
      };
    case 'companion':
      return {
        shareBadge: '这一条陪伴线',
        entryChip: '换你来接',
        experienceChip: '偏陪伴',
        encounterText: primaryInteractionName
          ? `先看看 ${primaryInteractionName} 回你时是什么味道。`
          : '先看看 TA 回你时是什么味道。',
        entryText: '换成你，也是在同一个世界里重新开始。名字定一下，就能聊起来。',
        experienceText: '偏陪伴、治愈、慢慢熟。',
        startLabel: primaryInteractionName ? `去见${primaryInteractionName}` : '开我的版本',
        detailLabel: '去门口看看',
        signedInBridge: primaryInteractionName
          ? `想亲自去见 ${primaryInteractionName}，现在就能开场。`
          : '想亲自把这条线接下去，现在就能开场。',
        guestBridge: primaryInteractionName
          ? `想亲自去见 ${primaryInteractionName}，先登录，回来还在这儿。`
          : '想亲自把这条线接下去，先登录，回来还在这儿。',
      };
    case 'role_play':
      return {
        shareBadge: '这一条代入线',
        entryChip: '先挑身份',
        experienceChip: '偏代入',
        encounterText: primaryInteractionName
          ? `先看 ${primaryInteractionName} 这场戏对不对味。`
          : '先看这场戏，是不是你想上的那种。',
        entryText: '真要进去时，会先让你挑身份。',
        experienceText: '偏代入、对戏、改写。',
        startLabel: '开我的版本',
        detailLabel: '去门口看看',
        signedInBridge: '想上场，就直接开始。',
        guestBridge: '想上场，就先登录；回来就能挑身份。',
      };
    default:
      return {
        shareBadge: '这一条世界线',
        entryChip: '换你来走',
        experienceChip: '偏冒险',
        encounterText: primaryInteractionName
          ? `这条线会先把 ${primaryInteractionName} 带到你面前。`
          : '这条线先把世界的第一口气递给你。',
        entryText: '换成你，会从同一个开场重新走。',
        experienceText: '偏开局、探索、往前闯。',
        startLabel: '开我的版本',
        detailLabel: '去门口看看',
        signedInBridge: '想接着走，现在就能开场。',
        guestBridge: '想接着走，先登录；回来还是这里。',
      };
  }
}

function getThemeClasses(isCharacterInteraction: boolean) {
  if (isCharacterInteraction) {
    return {
      hero: 'border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-orange-50 shadow-sm shadow-rose-100/50',
      solidBadge: 'bg-rose-500 text-white',
      softBadge: 'bg-white text-rose-500 ring-1 ring-rose-100',
      mutedBadge: 'bg-rose-100 text-rose-600',
      accentText: 'text-rose-500',
      accentSoftText: 'text-rose-400',
      card: 'border border-rose-100 bg-gradient-to-br from-white to-rose-50/70',
      helper: 'border border-rose-100 bg-rose-50/70 text-rose-600',
      primaryButton: 'bg-rose-500 text-white hover:bg-rose-600',
      secondaryButton: 'border-rose-200 bg-white text-rose-500 hover:border-rose-300 hover:bg-rose-50',
      footerGradient: 'from-rose-500 via-pink-500 to-orange-400',
      footerButtonText: 'text-rose-500',
    };
  }

  return {
    hero: 'border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-brand/5 shadow-sm shadow-sky-100/50',
    solidBadge: 'bg-brand text-white',
    softBadge: 'bg-white text-brand ring-1 ring-sky-100',
    mutedBadge: 'bg-sky-100 text-sky-700',
    accentText: 'text-brand',
    accentSoftText: 'text-brand/70',
    card: 'border border-sky-100 bg-gradient-to-br from-white to-sky-50/70',
    helper: 'border border-sky-100 bg-sky-50/70 text-sky-700',
    primaryButton: 'bg-brand text-white hover:bg-brand-dark',
    secondaryButton: 'border-brand/20 bg-white text-brand hover:border-brand/40 hover:bg-brand/5',
    footerGradient: 'from-brand to-brand-light',
    footerButtonText: 'text-brand',
  };
}

export default function SharedStoryPage() {
  const params = useParams();
  const token = params.token as string;
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<SharedMessageItem[]>([]);
  const [world, setWorld] = useState<SharedWorld | null>(null);
  const [sharedSession, setSharedSession] = useState<SharedSessionInfo | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError('');
      setSharedSession(null);
      try {
        const resp = await playAPI.getShared(token, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const data = resp.data || resp;
        const rawMessages = (data.messages || []) as ApiStoryMessage[];
        setMessages(convertBackendMessages(rawMessages));
        setWorld((data.world as SharedWorld | null) || null);
        setSharedSession((data.session as SharedSessionInfo | null) || null);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '分享链接无效或已过期');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => {
      controller.abort();
    };
  }, [token, retryCount]);

  const previewCharacterNames = useMemo(() => {
    const names = messages
      .filter((item) => item.message.role === 'character')
      .map((item) => item.message.characterName?.trim() || '')
      .filter(Boolean);

    return Array.from(new Set(names));
  }, [messages]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(239,246,255,0.92),rgba(255,255,255,0.98)_55%)]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    const errorCopy = getErrorCopy(error);
    const isRetryable = !/过期|不存在|无效/.test(error);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center text-gray-500">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-xl font-semibold text-gray-400">
          !
        </div>
        <p className="text-lg font-semibold text-gray-700">{errorCopy.title}</p>
        {errorCopy.detail && <p className="mt-2 max-w-md text-sm text-gray-400">{errorCopy.detail}</p>}
        <p className="mt-3 max-w-md text-sm text-gray-400">你也可以直接去入戏挑一个世界，登录后开始自己的版本。</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {isRetryable && (
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="rounded-lg border border-brand px-5 py-2 text-sm font-medium text-brand hover:bg-brand/5 transition-colors cursor-pointer"
            >
              重试
            </button>
          )}
          <Link
            href="/explore"
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-colors"
          >
            去探索页看看
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
          >
            回到首页
          </Link>
        </div>
      </div>
    );
  }

  const playTypeKey = getPlayTypeKey(world);
  const isCharacterInteraction = CHARACTER_PLAY_TYPES.has(playTypeKey);
  const theme = getThemeClasses(isCharacterInteraction);
  const primaryInteractionName = getPrimaryInteractionName(world, messages);
  const shareLens = getShareLens(playTypeKey, primaryInteractionName);
  const detailHref = world?.id ? `/world/${world.id}?from=share` : '/explore';
  const startRedirectHref = world?.id ? `/world/${world.id}?from=share&action=start` : '/explore';
  const authHref = world?.id ? `/auth?redirect=${encodeURIComponent(startRedirectHref)}` : '/auth?redirect=%2Fexplore';
  const startHref = world?.id ? (user ? startRedirectHref : authHref) : '/explore';
  const ctaLabel = world?.id ? shareLens.detailLabel : '去入戏发现更多世界';
  const secondaryCtaLabel = world?.id
    ? (user ? shareLens.startLabel : '登录后开始你的版本')
    : (user ? '开始你的版本' : '登录后开始你的版本');
  const startReadinessText = user ? '现在就能开你的版本。' : '登录后就能开你的版本。';
  const encounterChip = primaryInteractionName ? `先遇见 ${primaryInteractionName}` : previewCharacterNames[0] ? `先遇见 ${previewCharacterNames[0]}` : null;
  const sharedSessionStatus = (sharedSession?.status || '').trim();
  const sharedSessionIsEnding = sharedSessionStatus === 'completed' || sharedSessionStatus === 'abandoned';
  const sharedProtagonistName = sharedSession?.protagonist_name?.trim() || sharedSession?.protagonistName?.trim() || '';
  const sharedSummaryText = sharedSession?.summary?.trim() || '';
  const sharedSessionBadge = sharedSessionStatus === 'completed'
    ? '这条线落了一幕'
    : sharedSessionStatus === 'abandoned'
      ? '这条线先停在这儿'
      : '这条线刚走到这儿';
  const sharedSessionLead = sharedSummaryText
    ? sharedSummaryText
    : sharedSessionStatus === 'completed'
      ? '这一段已经走出了结果。'
      : sharedSessionStatus === 'abandoned'
        ? '这一段被留在了最有味道的地方。'
        : '这不是演示稿，是别人刚走出来的一条真线。';
  const heroTitle = world?.title
    ? `《${world.title}》里，这条线走到了这里`
    : '这条线走到了这里';
  const heroDescription = world
    ? `${sharedProtagonistName ? `${sharedProtagonistName} ` : '有人 '}把它走到了这里。你先看看它停在哪；想的话，就从《${world.title}》里走一条自己的。${startReadinessText}`
    : `你现在看到的，是别人刚走出来的一段。先看看它停在哪；想的话，再走出你的版本。${user ? '现在就能开始。' : '登录后就能开始。'}`;
  const shareBridgeText = user ? shareLens.signedInBridge : shareLens.guestBridge;
  const previewHeading = world?.title ? `《${world.title}》里，这条线怎么走到这儿` : '这条线怎么走到这儿';

  return (
    <div className="bg-[radial-gradient(circle_at_top,rgba(239,246,255,0.92),rgba(255,255,255,0.98)_55%)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 xl:px-8">
        <div className={`mb-6 rounded-[30px] p-5 sm:p-6 ${theme.hero}`}>
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${theme.solidBadge}`}>
                {sharedSessionBadge}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${theme.softBadge}`}>
                {shareLens.shareBadge}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${theme.mutedBadge}`}>
                {shareLens.entryChip}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${theme.mutedBadge}`}>
                {shareLens.experienceChip}
              </span>
              {encounterChip && (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${theme.softBadge}`}>
                  {encounterChip}
                </span>
              )}
            </div>

            <h1 className="mt-4 text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
              {heroTitle}
            </h1>
            <p className="mt-3 text-sm leading-7 text-gray-600 sm:text-[15px]">
              {heroDescription}
            </p>

            <div className={`mt-5 rounded-[24px] p-4 sm:p-5 ${theme.card}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.accentSoftText}`}>这一段，停在这里</p>
              <p className="mt-3 text-base font-semibold leading-7 text-gray-900 sm:text-[17px] sm:leading-8">{sharedSessionLead}</p>
              {sharedProtagonistName && (
                <p className="mt-3 text-xs leading-5 text-gray-500">把它走到这里的人：{sharedProtagonistName}</p>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className={`rounded-[22px] p-4 ${theme.card}`}>
                <p className={`text-[11px] font-semibold tracking-[0.16em] ${theme.accentSoftText}`}>你先会撞上什么</p>
                <p className="mt-2 text-sm leading-6 text-gray-700">{shareLens.encounterText}</p>
              </div>
              <div className={`rounded-[22px] p-4 ${theme.card}`}>
                <p className={`text-[11px] font-semibold tracking-[0.16em] ${theme.accentSoftText}`}>换你来</p>
                <p className="mt-2 text-sm leading-6 text-gray-700">{shareLens.entryText}</p>
              </div>
              <div className={`rounded-[22px] p-4 ${theme.card}`}>
                <p className={`text-[11px] font-semibold tracking-[0.16em] ${theme.accentSoftText}`}>这股味道</p>
                <p className="mt-2 text-sm leading-6 text-gray-700">{shareLens.experienceText}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/70 bg-white/70 px-4 py-3 text-sm leading-6 text-gray-600">
              {shareBridgeText}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={startHref}
                className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow ${theme.primaryButton}`}
              >
                {secondaryCtaLabel}
              </Link>
              <Link
                href={detailHref}
                className={`inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-all ${theme.secondaryButton}`}
              >
                {ctaLabel}
              </Link>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {user ? '同一个世界，换你来走。' : '先登录，回来还是这儿。'}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-brand/70">别人刚走过的一段</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900 sm:text-2xl">{previewHeading}</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {sharedSessionIsEnding
              ? '这是别人真走到这里的一版；换你开始时，会从同一个世界重新长出新线。'
              : '你现在看到的是别人已经走过的一段；遇到关键节点时，下面也会告诉你 TA 当时怎么选。'}
          </p>
        </div>

        <div id="shared-story-preview" className="rounded-[30px] border border-white/80 bg-white/82 p-4 shadow-[0_24px_56px_-40px_rgba(15,23,42,0.22)] sm:p-6">
          {messages.length === 0 && (
            <div className={`rounded-2xl border border-dashed px-6 py-10 text-center ${isCharacterInteraction ? 'border-rose-200 bg-rose-50/60' : 'border-brand/20 bg-brand/5'}`}>
              <p className="text-lg font-semibold text-gray-900">
                {world ? '这一条线还没摊开太多' : '这条分享暂时没有可展示的故事内容'}
              </p>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-gray-600">
                {world
                  ? `但《${world.title}》已经在门后等着了。想知道换成你会怎么走？`
                  : '不如直接去入戏挑一个世界，开你自己的那条线。'}
              </p>
              <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href={startHref}
                  className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-all ${theme.primaryButton}`}
                >
                  {secondaryCtaLabel}
                </Link>
                <Link
                  href={detailHref}
                  className={`inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-all ${theme.secondaryButton}`}
                >
                  {ctaLabel}
                </Link>
              </div>
            </div>
          )}

          {messages.map((item, index) => (
            <div key={item.message.messageKey || `${item.message.role}-${index}-${item.message.content}`}>
              <StoryMessage message={item.message} />
              {(item.selectedChoice || item.choices.length > 0) && item.message.role !== 'player' && (
                <div className={`mb-4 rounded-[22px] border px-4 py-3 ${theme.helper}`}>
                  <p className="text-[11px] font-semibold tracking-[0.16em]">
                    {item.selectedChoice ? '这一拍，TA 当时这么接' : '这一拍，会来到岔口'}
                  </p>
                  {item.selectedChoice && (
                    <p className="mt-2 text-sm font-semibold leading-6">“{item.selectedChoice}”</p>
                  )}
                  {item.choices.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.choices.map((choice) => {
                        const isSelected = choice === item.selectedChoice;
                        return (
                          <span
                            key={`${index}-${choice}`}
                            className={[
                              'rounded-full px-3 py-1.5 text-xs font-medium',
                              isSelected
                                ? isCharacterInteraction
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-brand text-white'
                                : 'bg-white/90 text-gray-600 ring-1 ring-black/5',
                            ].join(' ')}
                          >
                            {isSelected ? `TA 当时接的是：${choice}` : choice}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className={`mt-8 rounded-[30px] border bg-white p-5 text-center shadow-sm ${isCharacterInteraction ? 'border-rose-100' : 'border-sky-100'}`}
        >
          <p className="text-lg font-semibold text-gray-900">
            {world ? `轮到你走进《${world.title}》了` : '轮到你接着往前了'}
          </p>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            {shareBridgeText}
          </p>
          <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={startHref}
              className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold shadow-sm transition-all hover:shadow ${theme.primaryButton}`}
            >
              {secondaryCtaLabel}
            </Link>
            <Link
              href={detailHref}
              className={`inline-flex items-center justify-center rounded-full border px-6 py-3 text-sm font-semibold transition-all ${theme.secondaryButton}`}
            >
              {ctaLabel}
            </Link>
          </div>
        </m.div>
      </div>
    </div>
  );
}
