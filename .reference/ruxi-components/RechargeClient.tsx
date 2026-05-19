'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { SITE_CONFIG } from '@/config/site';
import { useAuth } from '@/lib/auth-context';
import { userAPI } from '@/lib/api';
import { toast } from '@/lib/toast';
import { copyText } from '@/lib/utils';

const PACKAGES = SITE_CONFIG.rechargePackages;

interface CreditLog {
  id: number;
  amount: number;
  balance_after?: number | null;
  reason: string;
  created_at: string;
}

interface RedeemFeedback {
  type: 'success' | 'error';
  text: string;
}

function normalizeRedeemErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message) return '兑换失败，请稍后再试';
  if (/过期/.test(message)) return '这个兑换码已经过期了，请换一个新的码再试。';
  if (/已使用|已兑换|不能重复/.test(message)) return '这个兑换码已经用过了，不能重复兑换。';
  if (/无效|不存在|错误|invalid/i.test(message)) return '这个兑换码不对，请检查字母和数字有没有输错后再试。';
  return message;
}

function getSafeRedirect(redirect: string | null): string {
  if (!redirect) return '/recharge';
  const normalized = redirect.trim();
  if (!normalized.startsWith('/') || normalized.startsWith('//')) return '/recharge';
  return normalized;
}

function buildPackageContactMessage(label: string, priceLabel: string): string {
  return `想补 ${label}（${priceLabel}），麻烦发我兑换码或帮我处理一下。`;
}

export default function RechargePage() {
  const { user, refreshUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = getSafeRedirect(searchParams.get('redirect'));
  const hasReturnTarget = redirectPath !== '/recharge';
  const rechargeEntryPath = hasReturnTarget ? `/recharge?redirect=${encodeURIComponent(redirectPath)}` : '/recharge';
  const [currentCredits, setCurrentCredits] = useState(0);
  const [dailyFreePlays, setDailyFreePlays] = useState<number | null>(null);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemFeedback, setRedeemFeedback] = useState<RedeemFeedback | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const packageSectionRef = useRef<HTMLDivElement>(null);
  const redeemSectionRef = useRef<HTMLDivElement>(null);
  const contactSectionRef = useRef<HTMLDivElement>(null);
  const logsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/auth?redirect=${encodeURIComponent(rechargeEntryPath)}`);
    }
  }, [authLoading, user, router, rechargeEntryPath]);

  const fetchCredits = useCallback(async (signal?: AbortSignal, options?: { silent?: boolean }) => {
    if (!user) return false;

    const { silent = false } = options || {};
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const res = await userAPI.getCredits({ limit: 100 }, signal ? { signal } : undefined);
      if (signal?.aborted) return false;
      const data = res.data || res;
      setCurrentCredits(data.credits ?? user.credits ?? 0);
      setDailyFreePlays(data.daily_free_plays ?? user.daily_free_plays ?? null);
      setLogs(data.logs || []);
      return true;
    } catch {
      if (signal?.aborted) return false;
      setCurrentCredits(user.credits ?? 0);
      setDailyFreePlays(user.daily_free_plays ?? null);
      setLoadError('积分记录没加载出来，刷新一下试试');
      return false;
    } finally {
      if (!signal?.aborted && !silent) setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) return;

    const controller = new AbortController();
    void fetchCredits(controller.signal);

    return () => {
      controller.abort();
    };
  }, [authLoading, fetchCredits, user]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const displayDailyFreePlays = dailyFreePlays ?? user?.daily_free_plays ?? null;
  const remainingFreePlays = displayDailyFreePlays ?? SITE_CONFIG.app.dailyFreePlays;
  const hasFreeTurns = remainingFreePlays > 0;
  const hasCreditsAvailable = currentCredits > 0;
  const hasNoImmediateBudget = !hasFreeTurns && !hasCreditsAvailable;
  const statusTitle = hasNoImmediateBudget
    ? '该补一点了'
    : hasFreeTurns
      ? '今天还能先玩'
      : `你还有 ${currentCredits} 积分`;
  const statusDescription = hasNoImmediateBudget
    ? '免费次数和积分都用完了。手里有兑换码就直接输，没有就挑个档位找我们。'
    : hasFreeTurns
      ? `今天还剩 ${remainingFreePlays} 次免费互动，先用完也行，顺手补一点也行。`
      : '现在还能直接继续。想先囤点积分，也可以在这页处理。';
  const recentLogs = logs.slice(0, 10);
  const latestLog = recentLogs[0] || null;
  const recommendedPackage = PACKAGES.find((pkg) => pkg.tag === '热门') || PACKAGES[1] || PACKAGES[0];

  const scrollToSection = (section: { current: HTMLDivElement | null }) => {
    section.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCopyContact = async (label: string, value: string) => {
    const copied = await copyText(value);
    if (copied) {
      toast.success(`${label}已复制`);
    } else {
      toast.error(`请手动复制${label}`);
    }
  };

  const handlePackageShortcut = async (pkg: (typeof PACKAGES)[number]) => {
    const message = buildPackageContactMessage(pkg.label, pkg.priceLabel);
    const copied = await copyText(message);
    if (copied) {
      toast.success('这句已经复制，直接发就行');
    } else {
      toast.error('复制失败，请手动复制');
    }
    scrollToSection(contactSectionRef);
  };

  const handleRedeem = async () => {
    if (redeeming) return;

    const normalizedCode = redeemCode.trim();
    if (!normalizedCode) {
      const errorText = '请输入兑换码';
      setRedeemFeedback({ type: 'error', text: errorText });
      toast.error(errorText);
      return;
    }

    setRedeemFeedback(null);
    setLoadError('');
    setRedeeming(true);
    try {
      const res = await userAPI.redeemCode(normalizedCode);
      const data = res.data || res;
      const nextBalance = data.new_balance ?? currentCredits;
      const successText = hasReturnTarget
        ? `兑换成功，+${data.credits_added} 积分，当前 ${nextBalance}。现在可以回去继续了。`
        : `兑换成功，+${data.credits_added} 积分，当前 ${nextBalance}。`;
      toast.success(successText);
      setRedeemFeedback({ type: 'success', text: successText });
      setRedeemCode('');
      setCurrentCredits(data.new_balance ?? currentCredits);
      await refreshUser();
      const refreshed = await fetchCredits(undefined, { silent: true });
      if (!refreshed) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(
          () => toast.error('积分记录刷新失败，请稍后刷新页面或重新进入本页'),
          3100,
        );
      }
    } catch (err: unknown) {
      const errorText = normalizeRedeemErrorMessage(err);
      setRedeemFeedback({ type: 'error', text: errorText });
      toast.error(errorText);
    } finally {
      setRedeeming(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-4">
        <div className="rounded-xl bg-white px-6 py-5 text-center shadow-sm">
          <p className="text-sm text-gray-500">{authLoading ? '正在打开补给页...' : '先去登录...'}</p>
        </div>
      </div>
    );
  }

  const heroStats = [
    {
      label: '现在有多少',
      value: loading ? '...' : String(currentCredits),
      desc: hasCreditsAvailable ? '够你直接继续' : '眼下没有可用积分',
    },
    {
      label: '今天免费',
      value: displayDailyFreePlays != null ? `${displayDailyFreePlays} 次` : '自动恢复',
      desc: hasFreeTurns ? '继续时会先用这个' : '今天的免费次数已经用完',
    },
    {
      label: '最省事的路',
      value: redeemCode.trim() ? '先把手里的码兑掉' : '先兑码，没有再联系',
      desc: hasReturnTarget ? '补好就能回到刚才那页。' : '这样通常最快。',
    },
    {
      label: '最近动静',
      value: latestLog ? `${latestLog.amount > 0 ? '+' : ''}${latestLog.amount}` : '暂无',
      desc: latestLog ? latestLog.reason : '到账和消耗都会记在这里。',
    },
  ];

  const quickContactMessage = buildPackageContactMessage(recommendedPackage.label, recommendedPackage.priceLabel);

  const contactCards = [
    {
      label: 'QQ',
      value: SITE_CONFIG.contact.qq,
      actionLabel: '复制 QQ',
      onClick: () => { void handleCopyContact('QQ 号', SITE_CONFIG.contact.qq); },
      tone: 'brand',
    },
    {
      label: '微信',
      value: SITE_CONFIG.contact.wechat,
      actionLabel: '复制微信',
      onClick: () => { void handleCopyContact('微信号', SITE_CONFIG.contact.wechat); },
      tone: 'brand',
    },
    {
      label: '邮箱',
      value: SITE_CONFIG.contact.email,
      actionLabel: '复制邮箱',
      onClick: () => { void handleCopyContact('邮箱', SITE_CONFIG.contact.email); },
      tone: 'neutral',
    },
  ] as const;

  const contactBundle = `QQ: ${SITE_CONFIG.contact.qq}\n微信: ${SITE_CONFIG.contact.wechat}\n邮箱: ${SITE_CONFIG.contact.email}\n这句话: ${quickContactMessage}`;

  return (
    <div className="mx-auto w-full max-w-[84rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <section className="relative mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-dark via-brand to-brand-light p-5 text-white shadow-[0_28px_72px_-34px_rgba(59,130,196,0.78)] sm:p-6 lg:p-8">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/90 backdrop-blur-sm">
                积分补给
              </span>
              {hasReturnTarget ? (
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm">
                  补好就能回去
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">{statusTitle}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/88 sm:text-base sm:leading-7">{statusDescription}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/90 sm:text-sm">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">输入兑换码</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">挑个档位</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">看看到账记录</span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:max-w-2xl">
              <button
                type="button"
                onClick={() => scrollToSection(redeemSectionRef)}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand transition-colors hover:bg-white/90 cursor-pointer"
              >
                输入兑换码
              </button>
              <button
                type="button"
                onClick={() => scrollToSection(packageSectionRef)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 cursor-pointer"
              >
                看看档位
              </button>
              <button
                type="button"
                onClick={() => router.push(hasReturnTarget ? redirectPath : '/profile?tab=settings')}
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 cursor-pointer"
              >
                {hasReturnTarget ? '回去继续' : '回我的地盘'}
              </button>
            </div>
          </div>

          <div className="w-full max-w-[22rem] rounded-[1.75rem] border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:p-5">
            <p className="text-xs font-semibold tracking-[0.18em] text-white/75">最快的方式</p>
            <div className="mt-3 rounded-2xl bg-white/12 px-4 py-4">
              <p className="text-xs text-white/70">推荐档位</p>
              <p className="mt-1 text-2xl font-bold text-white">{recommendedPackage.label}</p>
              <p className="mt-1 text-sm text-white/80">{recommendedPackage.priceLabel}</p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs text-white/70">现在更适合</p>
                <p className="mt-1 text-sm font-semibold text-white">{redeemCode.trim() ? '先把手里的码兑掉' : '先试兑换码，没有再来这里联系'}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs text-white/70">直接发这句</p>
                <p className="mt-1 text-sm font-semibold text-white">“想补 {recommendedPackage.label}（{recommendedPackage.priceLabel}）”</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { void handleCopyContact('这句话', quickContactMessage); }}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand transition-colors hover:bg-white/92 cursor-pointer"
              >
                复制这句话
              </button>
              <button
                type="button"
                onClick={() => scrollToSection(contactSectionRef)}
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 cursor-pointer"
              >
                查看联系方式
              </button>
            </div>
          </div>
        </div>

        <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {heroStats.map((item) => (
            <div key={item.label} className="rounded-[1.4rem] border border-white/15 bg-white/10 px-4 py-4 backdrop-blur-sm">
              <p className="text-xs font-medium text-white/70">{item.label}</p>
              <p className="mt-1 text-lg font-bold text-white">{item.value}</p>
              <p className="mt-1 text-xs leading-5 text-white/78">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {loadError && (
        <div className="mb-5 rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-600">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => { void fetchCredits(); }}
            className="mt-3 inline-flex rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 cursor-pointer"
          >
            重新加载
          </button>
        </div>
      )}

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
        <div ref={redeemSectionRef} className="rounded-[1.8rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-emerald-600">兑换码</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">有码就直接兑</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              到账会直接记到当前账号；如果你是从别处跳来的，成功后就能回去继续。
            </p>

            </div>
            {hasReturnTarget ? (
              <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-600">
                兑完就能回去
              </span>
            ) : null}
          </div>

          <div className="mt-4 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/70 px-4 py-4">
            <div className="flex flex-wrap gap-2 text-xs text-emerald-700">
              <span className="rounded-full bg-white px-3 py-1 font-medium">直接到账</span>
              <span className="rounded-full bg-white px-3 py-1 font-medium">余额会刷新</span>
              {hasReturnTarget ? <span className="rounded-full bg-white px-3 py-1 font-medium">补好就能回去</span> : null}
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row" aria-busy={redeeming}>
              <input
                type="text"
                placeholder="请输入兑换码"
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter' && redeemCode.trim()) {
                    void handleRedeem();
                  }
                }}
                disabled={redeeming}
                className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm uppercase tracking-[0.24em] outline-none transition-colors focus:border-brand disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                type="button"
                onClick={() => { void handleRedeem(); }}
                disabled={redeeming || !redeemCode.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {redeeming ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    兑换中...
                  </>
                ) : '立即兑换'}
              </button>
            </div>

            <p className={`mt-3 text-xs leading-5 ${redeeming ? 'text-brand' : 'text-gray-500'}`}>
              {redeeming ? '正在核验兑换码并刷新余额，请稍等。' : '没兑换码的话，就去右侧挑个档位。'}
            </p>
          </div>

          {redeemFeedback && (
            <div className={`mt-4 rounded-[1.5rem] px-4 py-4 ${redeemFeedback.type === 'success' ? 'border border-emerald-100 bg-emerald-50' : 'border border-red-100 bg-red-50'}`}>
              <p className={`text-sm leading-6 ${redeemFeedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
                {redeemFeedback.text}
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {redeemFeedback.type === 'success' && hasReturnTarget ? (
                  <button
                    type="button"
                    onClick={() => router.push(redirectPath)}
                    className="inline-flex items-center justify-center rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 cursor-pointer"
                  >
                    回去继续
                  </button>
                ) : null}
                {redeemFeedback.type === 'error' ? (
                  <button
                    type="button"
                    onClick={() => scrollToSection(contactSectionRef)}
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 cursor-pointer"
                  >
                    找我们帮你看看
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div ref={contactSectionRef} className="rounded-[1.8rem] border border-brand/15 bg-gradient-to-br from-brand/8 via-white to-brand/5 p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">没兑换码也行</p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">挑个档位，发一句话给我们</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              先决定补多少，再把联系方式和这句话发出去就够了。
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.45rem] border border-brand/10 bg-white/88 px-4 py-4 shadow-sm">
                <p className="text-xs font-medium text-brand/70">推荐档位</p>
                <p className="mt-1 text-base font-semibold text-gray-900">{recommendedPackage.label}</p>
                <p className="mt-1 text-sm text-gray-500">{recommendedPackage.priceLabel} · {recommendedPackage.credits} 积分</p>
              </div>
              <div className="rounded-[1.45rem] border border-brand/10 bg-white/88 px-4 py-4 shadow-sm">
                <p className="text-xs font-medium text-brand/70">直接发这句</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-gray-900">{quickContactMessage}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-[1.45rem] border border-brand/10 bg-white/88 px-4 py-4 shadow-sm">
                <p className="text-xs font-medium text-brand/70">拿不准时</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">先从推荐档位开始</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">下面每一档都附了一句可以直接发的话。</p>
              </div>
              <div className="rounded-[1.45rem] border border-brand/10 bg-white/88 px-4 py-4 shadow-sm">
                <p className="text-xs font-medium text-brand/70">想快一点</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">复制一句话，直接发给我们</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">我们会回你兑换码，或继续帮你处理。</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {contactCards.map((card) => (
                <button
                  key={card.label}
                  type="button"
                  onClick={card.onClick}
                  className={`rounded-[1.5rem] border p-4 text-left transition-colors ${card.tone === 'brand' ? 'border-brand/10 bg-brand/5 hover:border-brand/20' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'} cursor-pointer`}
                >
                  <p className={`text-xs font-medium uppercase tracking-wide ${card.tone === 'brand' ? 'text-brand/80' : 'text-gray-500'}`}>
                    {card.label}
                  </p>
                  <p className="mt-2 break-all text-base font-semibold text-gray-900">{card.value}</p>
                  <span className={`mt-4 inline-flex rounded-xl px-3 py-2 text-sm font-semibold ${card.tone === 'brand' ? 'bg-white text-brand shadow-sm' : 'bg-white text-gray-700 shadow-sm'}`}>
                    {card.actionLabel}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { void handleCopyContact('联系方式和这句话', contactBundle); }}
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark cursor-pointer"
              >
                复制联系方式和这句话
              </button>
              <button
                type="button"
                onClick={() => { void handleCopyContact('这句话', quickContactMessage); }}
                className="inline-flex items-center justify-center rounded-2xl border border-brand/15 bg-white px-4 py-3 text-sm font-semibold text-brand transition-colors hover:bg-brand/10 cursor-pointer"
              >
                只复制这句话
              </button>
            </div>
          </div>
        </div>
      </section>

      <section ref={packageSectionRef} className="mb-5 rounded-[1.8rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">积分档位</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">挑好档位，再来联系</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">这里先帮你挑数量，不在站内付款。选好后直接联系我们就行。</p>
          </div>
          <button
            type="button"
            onClick={() => scrollToSection(contactSectionRef)}
            className="inline-flex items-center justify-center rounded-2xl border border-brand/15 bg-brand/5 px-4 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10 cursor-pointer"
          >
            查看联系方式
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PACKAGES.map((pkg) => (
            <div key={pkg.credits} className="relative flex h-full flex-col rounded-[1.6rem] border border-gray-200 bg-white p-5 shadow-sm">
              {pkg.tag ? (
                <span className="absolute right-4 top-4 rounded-full bg-yellow-100 px-2.5 py-1 text-[11px] font-semibold text-yellow-800">
                  {pkg.tag}
                </span>
              ) : null}
              <p className="text-xl font-black text-gray-900">{pkg.label}</p>
              <p className="mt-1 text-sm text-gray-500">{pkg.priceLabel}</p>
              <p className="mt-1 text-xs text-gray-400">约 {(pkg.price / pkg.credits * 100).toFixed(1)} 分 / 积分</p>

              <div className="mt-4 rounded-[1.3rem] border border-dashed border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-5 text-amber-800">
                适合一次补一段；挑好就能直接发。
              </div>

              <div className="mt-4 flex-1 text-xs leading-5 text-gray-500">
                可直接发：{buildPackageContactMessage(pkg.label, pkg.priceLabel)}
              </div>

              <button
                type="button"
                onClick={() => { void handlePackageShortcut(pkg); }}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-brand/15 bg-brand/5 px-3 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/10 cursor-pointer"
              >
                复制这句去联系
              </button>
            </div>
          ))}
        </div>
      </section>

      <section ref={logsSectionRef} className="rounded-[1.8rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">最近记录</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">最近积分记录</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">只放最近 10 条，看看有没有到账就够了。</p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/profile?tab=settings')}
            className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 cursor-pointer"
          >
            去我的地盘看更多
          </button>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : recentLogs.length === 0 ? (
            <div className="rounded-[1.5rem] bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">还没有积分记录</div>
          ) : (
            <div className="space-y-2">
              {recentLogs.map((log) => (
                <div key={log.id} className="rounded-[1.4rem] border border-gray-100 bg-gray-50/80 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium text-gray-800">{log.reason}</p>
                      <p className="mt-1 text-xs text-gray-400">{new Date(log.created_at).toLocaleString('zh-CN')}</p>
                    </div>
                    <div className="sm:text-right">
                      <span className={`text-sm font-semibold ${log.amount > 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {log.amount > 0 ? '+' : ''}
                        {log.amount}
                      </span>
                      {log.balance_after != null ? (
                        <p className="mt-1 text-[11px] text-gray-400">余额 {log.balance_after}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
