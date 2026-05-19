'use client';

import { memo, useState } from 'react';
import { m } from 'framer-motion';

interface ChoiceButtonProps {
  index: number;
  text: string;
  onSelect: (text: string) => void | Promise<void>;
  disabled?: boolean;
  layout?: 'stack' | 'carousel' | 'inline';
}

export const ChoiceButton = memo(function ChoiceButton({ index, text, onSelect, disabled, layout = 'stack' }: ChoiceButtonProps) {
  const [pending, setPending] = useState(false);
  const isPending = pending;
  const isDisabled = Boolean(disabled || isPending);

  return (
    <m.button
      whileHover={isDisabled ? {} : { y: -1 }}
      whileTap={isDisabled ? {} : { scale: 0.99 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: index * 0.04, ease: 'easeOut' }}
      onClick={async () => {
        if (isDisabled) return;
        setPending(true);
        try {
          await onSelect(text);
        } finally {
          setPending(false);
        }
      }}
      disabled={isDisabled}
      aria-busy={isPending}
      aria-label={isPending ? `正接这句：${text}` : `选这句：${text}`}
      className={[
        layout === 'carousel'
          ? 'w-[82vw] min-w-[82vw] shrink-0 snap-start rounded-[18px] px-4 py-3 text-left sm:w-full sm:min-w-0'
          : layout === 'inline'
            ? 'w-auto max-w-full rounded-[18px] px-3.5 py-2.5 text-left'
            : 'w-full rounded-[18px] px-4 py-3 text-left sm:px-4',
        layout === 'inline' ? 'min-h-[42px]' : 'min-h-[48px]',
        'border break-words transition-[transform,color,box-shadow,border-color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15',
        isPending
          ? 'border-brand/25 bg-brand/8 text-brand shadow-[0_12px_24px_-22px_rgba(59,130,196,0.4)] cursor-progress'
          : isDisabled
            ? 'border-gray-200 bg-gray-50 text-gray-400 shadow-none cursor-not-allowed'
            : 'border-slate-200/90 bg-white/88 text-slate-700 shadow-[0_10px_24px_-24px_rgba(15,23,42,0.22)] hover:border-brand/20 hover:bg-white hover:text-slate-900 cursor-pointer',
      ].join(' ')}
    >
      <span className="flex items-start gap-2">
        <span
          className={[
            'mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
            layout === 'inline' ? 'h-5 w-5' : 'h-6 w-6',
            isPending
              ? 'bg-brand/12 text-brand'
              : isDisabled
                ? 'bg-gray-200 text-gray-400'
                : 'bg-brand/10 text-brand/80',
          ].join(' ')}
          aria-hidden="true"
        >
          {isPending ? '…' : '↗'}
        </span>
        <span className={`block whitespace-pre-wrap break-words ${layout === 'inline' ? 'text-[13px] leading-5 sm:text-[14px]' : 'text-[14px] leading-6 sm:text-[15px]'}`}>
          {text}
        </span>
      </span>
    </m.button>
  );
});
