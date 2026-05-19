'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { m } from 'framer-motion';
import { SITE_CONFIG } from '@/config/site';

export interface StoryMessageData {
  role: 'narrator' | 'character' | 'player';
  content: string;
  characterName?: string;
  messageKey?: string;
}

interface StoryMessageProps {
  message: StoryMessageData;
  typewriter?: boolean;
  onTypingDone?: () => void;
  isOpeningMessage?: boolean;
}

const PALETTE = ['#3b82c4', '#b8860b', '#8b5cf6', '#10b981', '#e11d48', '#d97706', '#0891b2', '#7c3aed', '#059669', '#dc2626'];

function charColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const fullHex = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(fullHex)) {
    return `rgba(107, 114, 128, ${alpha})`;
  }

  const int = Number.parseInt(fullHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const TYPEWRITER_SPEED_MS = SITE_CONFIG.ui.typewriterSpeedMs;
const MAX_TYPEWRITER_DURATION_MS = SITE_CONFIG.ui.maxTypewriterDurationMs;

function StoryMessageBody({ message, typewriter = false, onTypingDone, isOpeningMessage = false }: StoryMessageProps) {
  const [displayedText, setDisplayedText] = useState(typewriter ? '' : message.content);
  const onTypingDoneRef = useRef(onTypingDone);

  useEffect(() => {
    onTypingDoneRef.current = onTypingDone;
  }, [onTypingDone]);

  useEffect(() => {
    if (!typewriter || !message.content) {
      if (typewriter && !message.content) {
        onTypingDoneRef.current?.();
      }
      return;
    }

    const maxFrames = Math.max(1, Math.floor(MAX_TYPEWRITER_DURATION_MS / TYPEWRITER_SPEED_MS));
    const step = Math.max(1, Math.ceil(message.content.length / maxFrames));

    const interval = setInterval(() => {
      setDisplayedText((prev) => {
        const nextLength = Math.min(prev.length + step, message.content.length);
        const next = message.content.slice(0, nextLength);
        if (nextLength >= message.content.length) {
          clearInterval(interval);
          onTypingDoneRef.current?.();
        }
        return next;
      });
    }, TYPEWRITER_SPEED_MS);

    return () => clearInterval(interval);
  }, [message.content, typewriter]);

  const text = typewriter ? displayedText : message.content;
  const showCursor = typewriter && displayedText.length < message.content.length;

  if (message.role === 'narrator') {
    return (
      <m.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: 'easeOut' }}
        className={isOpeningMessage ? 'py-5 sm:py-6' : 'py-3 sm:py-4'}
      >
        <div className={`mx-auto ${isOpeningMessage ? 'max-w-[48rem]' : 'max-w-[46rem]'}`}>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span>{isOpeningMessage ? '开场' : '场上'}</span>
          </div>
          <p className={`whitespace-pre-wrap break-words text-slate-800 ${isOpeningMessage ? 'text-[17px] leading-9 sm:text-[18px] sm:leading-10' : 'text-[15px] leading-8 sm:text-[16px] sm:leading-8'}`}>
            {text}
            {showCursor && <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse align-middle bg-slate-400" />}
          </p>
        </div>
      </m.div>
    );
  }

  if (message.role === 'character') {
    const characterLabel = message.characterName?.trim() || '角色';
    const color = charColor(characterLabel);
    const avatarBg = hexToRgba(color, isOpeningMessage ? 0.14 : 0.1);
    const bubbleBg = hexToRgba(color, isOpeningMessage ? 0.08 : 0.04);
    const bubbleBorder = hexToRgba(color, isOpeningMessage ? 0.2 : 0.12);

    return (
      <m.div
        initial={{ opacity: 0, x: -16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={isOpeningMessage ? 'py-2.5 sm:py-3' : 'py-2'}
      >
        <div className="flex items-start gap-3 sm:gap-3.5">
          <div
            className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${isOpeningMessage ? 'h-10 w-10 text-sm' : 'h-9 w-9 text-sm'}`}
            style={{ backgroundColor: avatarBg, color }}
            aria-hidden="true"
          >
            {characterLabel.charAt(0)}
          </div>
          <div className="max-w-[90%] sm:max-w-[41rem] lg:max-w-[44rem]">
            <p className="mb-1.5 pl-1 text-[12px] font-semibold" style={{ color }}>
              {characterLabel}
            </p>
            <div
              className={`border px-4 py-3 sm:px-5 sm:py-4 ${isOpeningMessage ? 'rounded-[28px] rounded-bl-xl' : 'rounded-[24px] rounded-bl-md'}`}
              style={{ backgroundColor: bubbleBg, borderColor: bubbleBorder }}
            >
              <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-gray-900 sm:text-[16px] sm:leading-8">
                {text}
                {showCursor && <span className="ml-0.5 inline-block h-5 w-0.5 animate-pulse align-middle bg-gray-400" />}
              </p>
            </div>
          </div>
        </div>
      </m.div>
    );
  }

  return (
    <m.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="flex justify-end py-2"
    >
      <div className="max-w-[88%] sm:max-w-[38rem] lg:max-w-[42rem]">
        <p className="mb-1.5 pr-1 text-right text-[12px] font-semibold text-brand/70">你</p>
        <div className="rounded-[24px] rounded-br-md border border-brand/10 bg-[linear-gradient(135deg,rgba(239,246,255,0.82),rgba(255,255,255,0.98))] px-4 py-3 shadow-[0_18px_36px_-30px_rgba(59,130,196,0.24)] sm:px-5 sm:py-4">
          <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-gray-800 sm:text-[16px] sm:leading-8">
            {text}
          </p>
        </div>
      </div>
    </m.div>
  );
}

export const StoryMessage = memo(function StoryMessage(props: StoryMessageProps) {
  const messageIdentity = props.message.messageKey || `${props.message.role}:${props.message.characterName || ''}:${props.message.content}`;
  const key = `${messageIdentity}:${props.typewriter ? 'typewriter' : 'plain'}`;
  return <StoryMessageBody key={key} {...props} />;
});
