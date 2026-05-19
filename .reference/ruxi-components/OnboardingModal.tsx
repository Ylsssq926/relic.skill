'use client';

import { useState, useEffect, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { m, AnimatePresence } from 'framer-motion';
import { getAuthToken, worldsAPI } from '@/lib/api';
import { safeStorage } from '@/lib/utils';
import { SITE_CONFIG } from '@/config/site';

const STEPS = [
  {
    title: '欢迎来到入戏！',
    desc: '这里是一个 AI 驱动的互动叙事平台。你可以选择一个世界，创建自己的角色，让 AI 带你走进无限可能的故事。',
    icon: '🌟',
  },
  {
    title: '选一个世界开始冒险',
    desc: '我们为你推荐了几个热门世界，点击即可开始你的第一次冒险。',
    icon: '🗺️',
  },
  {
    title: '或者创建你自己的世界',
    desc: '有脑洞？用你的想象力构建独一无二的互动故事，让其他玩家走进你的世界。',
    icon: '✨',
  },
];

type FeaturedWorldItem = { title: string; genre: string; desc: string; href: string };

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

function getOnboardingStorageKey(): string {
  try {
    const rawUser = safeStorage.getItem('user_info');
    if (rawUser) {
      const user = JSON.parse(rawUser) as { id?: number };
      if (user?.id) return `onboarding_done:${user.id}`;
    }

    const token = getAuthToken();
    const payload = token?.split('.')[1];
    if (payload) {
      const decoded = JSON.parse(decodeBase64Url(payload)) as { id?: number };
      if (decoded?.id) return `onboarding_done:${decoded.id}`;
    }
  } catch {
    // ignore storage / decode failures
  }

  return 'onboarding_done';
}

export function OnboardingModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [featuredWorlds, setFeaturedWorlds] = useState<FeaturedWorldItem[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);

  useEffect(() => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const done = safeStorage.getItem(getOnboardingStorageKey());
      if (!done) {
        startTransition(() => setShow(true));
      }
    } catch {
      // localStorage unavailable — skip onboarding
    }
  }, []);

  const handleClose = useCallback(() => {
    try {
      safeStorage.setItem(getOnboardingStorageKey(), '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  }, []);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, handleClose]);

  useEffect(() => {
    if (!show) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const controller = new AbortController();
    startTransition(() => setFeaturedLoading(true));
    worldsAPI
      .featured(undefined, { signal: controller.signal })
      .then((res: Record<string, unknown>) => {
        if (controller.signal.aborted) return;
        const data = res.data as Record<string, unknown> | undefined;
        const raw = data?.featured || data?.worlds || data?.hot || res.featured || res.worlds || res.hot || [];
        const worlds = (Array.isArray(raw) ? raw : []).slice(0, 3) as Record<string, unknown>[];
        setFeaturedWorlds(
          worlds.map((world) => ({
            title: world.title as string,
            genre: (world.genre as string) || '',
            desc: ((world.description as string) || '').slice(0, 20),
            href: `/world/${world.id}`,
          })),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setFeaturedLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [show]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  if (!show) return null;

  const current = STEPS[step];

  return (
    <AnimatePresence>
      {show && (
        <>
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={handleClose}
          />
          <m.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-title"
            className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-white sm:top-1/2 sm:left-1/2 sm:h-auto sm:w-[90vw] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:shadow-2xl"
          >
            <div className="flex justify-center gap-2 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:pt-5">
              {STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === step ? 'w-6 bg-brand' : index < step ? 'w-2 bg-brand/40' : 'w-2 bg-gray-200'
                  }`}
                />
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 text-center sm:flex-none">
              <span className="mb-4 block text-5xl">{current.icon}</span>
              <h2 id="onboarding-title" className="text-xl font-bold text-gray-900">
                {current.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">{current.desc}</p>

              {step === 1 && featuredLoading && <p className="mt-4 text-xs text-gray-400">加载推荐中…</p>}

              {step === 1 && !featuredLoading && featuredWorlds.length > 0 && (
                <div className="mt-4 space-y-2">
                  {featuredWorlds.map((world) => (
                    <Link
                      key={world.href}
                      href={world.href}
                      onClick={handleClose}
                      className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 text-left transition-colors hover:border-brand/30 hover:bg-brand/5"
                    >
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-800">{world.title}</div>
                        <div className="text-xs text-gray-400">
                          {SITE_CONFIG.genres.find((g) => g.key === world.genre)?.name || world.genre} · {world.desc}
                        </div>
                      </div>
                      <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}

              {step === 2 && (
                <Link
                  href="/workshop/create"
                  onClick={handleClose}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand/30 px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand/5"
                >
                  <span>🛠️</span>
                  前往创作工坊
                </Link>
              )}
            </div>

            <div className="flex gap-3 px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-6">
              {step > 0 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 cursor-pointer"
                >
                  上一步
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark cursor-pointer"
              >
                {step === STEPS.length - 1 ? '开始探索' : '下一步'}
              </button>
            </div>

            <button
              onClick={handleClose}
              className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] rounded-lg p-1.5 text-gray-300 transition-colors hover:text-gray-500 cursor-pointer sm:top-3"
              aria-label="跳过"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
