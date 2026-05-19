'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import { SITE_CONFIG } from '@/config/site';
import { subscribeToast, type ToastPayload, type ToastType } from '@/lib/toast';

const TOAST_DURATION = SITE_CONFIG.ui.toastDurationMs;

const TOAST_STYLES: Record<ToastType, { badge: string; text: string; icon: ReactNode; shadow: string }> = {
  success: {
    badge: 'bg-brand text-white',
    text: 'text-gray-900',
    shadow: 'shadow-[0_14px_34px_rgba(59,130,196,0.22)]',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
      </svg>
    ),
  },
  error: {
    badge: 'bg-red-500 text-white',
    text: 'text-gray-900',
    shadow: 'shadow-[0_14px_34px_rgba(239,68,68,0.2)]',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
      </svg>
    ),
  },
  info: {
    badge: 'bg-brand/10 text-brand',
    text: 'text-gray-900',
    shadow: 'shadow-[0_14px_34px_rgba(59,130,196,0.18)]',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v.01M11 12h1v4h1" />
      </svg>
    ),
  },
};

export default function Toast() {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const timerMapRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timerMap = timerMapRef.current;
    const unsubscribe = subscribeToast((payload) => {
      setToasts((prev) => [...prev, payload]);

      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== payload.id));
        timerMap.delete(payload.id);
      }, TOAST_DURATION);

      timerMap.set(payload.id, timer);
    });

    return () => {
      unsubscribe();
      timerMap.forEach((timer) => clearTimeout(timer));
      timerMap.clear();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-3 px-4 sm:top-5">
      <AnimatePresence initial={false}>
        {toasts.map((item) => {
          const style = TOAST_STYLES[item.type];

          return (
            <m.div
              key={item.id}
              initial={{ opacity: 0, y: -18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-brand/15 bg-white/[0.96] px-4 py-3 backdrop-blur ${style.shadow}`}
              role="status"
              aria-live="polite"
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.badge}`}>
                {style.icon}
              </span>
              <p className={`min-w-0 flex-1 text-sm font-medium leading-6 ${style.text}`}>{item.message}</p>
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
