'use client';

import { useMemo, useRef } from 'react';
import Link from 'next/link';
import { STATUS_COPY } from '@/config/copy';
import { useAuth } from '@/lib/auth-context';
import { SITE_CONFIG } from '@/config/site';
import { toast } from '@/lib/toast';
import { copyText } from '@/lib/utils';

const TIERS = SITE_CONFIG.membershipPlans;
const CONTACT_MESSAGE = '我想开通高级版，麻烦发我开通方式。';

export default function MembershipPage() {
  const { user, loading: authLoading } = useAuth();
  const contactSectionRef = useRef<HTMLDivElement>(null);

  const handleCopy = async (label: string, value: string) => {
    const copied = await copyText(value);
    if (copied) {
      toast.success(`${label}已复制`);
    } else {
      toast.error(`复制失败，请手动复制${label}`);
    }
  };

  const scrollToContact = () => {
    contactSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const redirectToLogin = () => {
    if (typeof window === 'undefined') return;
    window.location.href = '/auth?redirect=%2Fmembership';
  };

  const handleOpenMembership = () => {
    if (authLoading) return;
    if (!user) {
      redirectToLogin();
      return;
    }
    scrollToContact();
  };

  const handlePrimaryFooterAction = () => {
    if (authLoading) return;
    if (!user) {
      redirectToLogin();
      return;
    }
    void handleCopy('联系方式和咨询信息', contactBundle);
  };

  const currentTier = user?.level || 'free';
  const currentTierName = SITE_CONFIG.tierNames[currentTier] || '免费版';
  const currentTierBadgeLabel = authLoading ? STATUS_COPY.loading.detail : user ? currentTierName : '未登录';
  const freeDailyPlays = SITE_CONFIG.app.dailyFreePlays;
  const premiumDailyPlays = SITE_CONFIG.app.premiumDailyFreePlays;
  const extraDailyPlays = premiumDailyPlays - freeDailyPlays;
  const monthlyExtraPlays = extraDailyPlays * 30;
  const isPremiumCurrent = Boolean(user) && currentTierName === '高级版';
  const isGuest = !user;
  const primaryCtaLabel = authLoading ? STATUS_COPY.loading.detail : isPremiumCurrent ? '看看续费 / 咨询' : isGuest ? '登录后开通' : '了解开通方式';
  const secondaryOverviewCtaLabel = authLoading ? STATUS_COPY.loading.detail : isGuest ? '登录后开通' : '查看联系方式';
  const footerPrimaryCtaLabel = authLoading ? STATUS_COPY.loading.detail : isGuest ? '登录后开通' : '复制联系方式和咨询信息';
  const premiumPlan = TIERS.find((tier) => tier.highlight) || TIERS[1] || TIERS[0];
  const contactBundle = `QQ: ${SITE_CONFIG.contact.qq}\n微信: ${SITE_CONFIG.contact.wechat}\n邮箱: ${SITE_CONFIG.contact.email}\n咨询信息: ${CONTACT_MESSAGE}`;

  const heroStats = [
    {
      label: '免费版',
      value: `每日 ${freeDailyPlays} 次`,
      desc: '偶尔回来玩一会儿，已经够用。',
    },
    {
      label: '高级版',
      value: `每日 ${premiumDailyPlays} 次`,
      desc: '更适合长期追剧情、多线并行。',
    },
    {
      label: '差别在哪',
      value: `每天多 ${extraDailyPlays} 次`,
      desc: `按 30 天算，大约多 ${monthlyExtraPlays} 次互动。`,
    },
  ];

  const conversionPanels = [
    {
      label: '适合升级',
      title: '常回来，或同时追多条线',
      desc: '这种用法下，高级版会比零散补积分更省心。',
      tone: 'brand' as const,
    },
    {
      label: '先不着急',
      title: '只是偶尔回来玩一会儿',
      desc: '这种节奏下，先用免费版或按次补积分会更灵活。',
      tone: 'neutral' as const,
      href: '/recharge',
    },
  ];

  const comparisonRows = useMemo(() => [
    { label: '每日免费互动', free: `${freeDailyPlays} 次`, premium: `${premiumDailyPlays} 次` },
    { label: 'AI 模型', free: '基础 AI 模型', premium: '全部 AI 模型' },
    { label: '创作工坊', free: '无限创建', premium: '无限创建' },
    { label: '优先排队', free: '—', premium: '支持' },
    { label: '人工协助', free: '—', premium: '专属协助' },
    { label: '适合人群', free: '轻量试玩 / 低频回访', premium: '长期追剧情 / 高频游玩' },
  ], [freeDailyPlays, premiumDailyPlays]);

  const contactCards = [
    {
      label: 'QQ',
      value: SITE_CONFIG.contact.qq,
      actionLabel: '复制 QQ',
      onClick: () => { void handleCopy('QQ 号', SITE_CONFIG.contact.qq); },
      tone: 'brand',
    },
    {
      label: '微信',
      value: SITE_CONFIG.contact.wechat,
      actionLabel: '复制微信',
      onClick: () => { void handleCopy('微信号', SITE_CONFIG.contact.wechat); },
      tone: 'brand',
    },
    {
      label: '邮箱',
      value: SITE_CONFIG.contact.email,
      actionLabel: '复制邮箱',
      onClick: () => { void handleCopy('邮箱', SITE_CONFIG.contact.email); },
      tone: 'neutral',
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[84rem] px-4 py-6 sm:px-6 sm:py-8 xl:px-8">
      <section className="relative mb-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-dark via-brand to-brand-light p-5 text-white shadow-[0_28px_72px_-34px_rgba(59,130,196,0.78)] sm:p-6 lg:p-8">
        <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-white/90 backdrop-blur-sm">
                会员中心
              </span>
              <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/85 backdrop-blur-sm">
                当前方案：{currentTierBadgeLabel}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">
              {isPremiumCurrent ? '你已在高级版，继续玩就好' : '高级版，让高频游玩更顺'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/88 sm:text-base sm:leading-7">
              {isPremiumCurrent
                ? `高级版每天 ${premiumDailyPlays} 次免费互动，多条线一起追也更从容。`
                : `免费版每天 ${freeDailyPlays} 次，高级版每天 ${premiumDailyPlays} 次。回来得越勤，差别越明显。`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/90 sm:text-sm">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">更高每日额度</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">全部 AI 模型</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">优先排队</span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:max-w-2xl">
              <button
                type="button"
                onClick={handleOpenMembership}
                disabled={authLoading}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/70 cursor-pointer"
              >
                {primaryCtaLabel}
              </button>
              <button
                type="button"
                onClick={() => { void handleCopy('咨询信息', CONTACT_MESSAGE); }}
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 cursor-pointer"
              >
                复制咨询信息
              </button>
              <Link
                href="/recharge"
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15"
              >
                先看积分补给
              </Link>
            </div>
          </div>

          <div className="w-full max-w-[22rem] rounded-[1.75rem] border border-white/15 bg-white/10 p-4 backdrop-blur-md sm:p-5">
            <p className="text-xs font-semibold tracking-[0.18em] text-white/75">高级版概览</p>
            <div className="mt-3 rounded-2xl bg-white/12 px-4 py-4">
              <p className="text-xs text-white/70">当前推荐</p>
              <p className="mt-1 text-2xl font-bold text-white">{premiumPlan?.name || '高级版'}</p>
              <p className="mt-1 text-sm text-white/80">{premiumPlan?.price || '¥29/月'} · 适合常回来的人</p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs text-white/70">适合场景</p>
                <p className="mt-1 text-sm font-semibold text-white">常回来，或同时追多条线</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs text-white/70">开通方式</p>
                <p className="mt-1 text-sm font-semibold text-white">复制咨询信息，直接联系开通</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3">
                <p className="text-xs text-white/70">可直接发送</p>
                <p className="mt-1 text-sm font-semibold text-white">{CONTACT_MESSAGE}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { void handleCopy('咨询信息', CONTACT_MESSAGE); }}
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-brand transition-colors hover:bg-white/92 cursor-pointer"
              >
                复制咨询信息
              </button>
              <button
                type="button"
                onClick={handleOpenMembership}
                disabled={authLoading}
                className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:bg-white/5 cursor-pointer"
              >
                {secondaryOverviewCtaLabel}
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

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
        <div className="grid gap-4 lg:grid-cols-2">
          {TIERS.map((tier) => {
            const isCurrent = Boolean(user) && tier.name === currentTierName;
            const tierTone = tier.highlight
              ? 'border border-brand/20 bg-gradient-to-br from-brand to-brand-light text-white shadow-[0_22px_48px_-28px_rgba(59,130,196,0.7)]'
              : 'border border-gray-200 bg-white text-gray-900 shadow-sm';

            return (
              <div key={tier.name} className={`relative flex h-full flex-col rounded-[1.8rem] p-5 ${tierTone}`}>
                {tier.tag ? (
                  <span className="absolute right-5 top-5 rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-gray-900">
                    {tier.tag}
                  </span>
                ) : null}
                <div className="pr-16">
                  <p className={`text-sm font-semibold ${tier.highlight ? 'text-white/80' : 'text-gray-500'}`}>{tier.name}</p>
                  <p className={`mt-2 text-3xl font-black ${tier.highlight ? 'text-white' : 'text-gray-900'}`}>{tier.price}</p>
                  <p className={`mt-2 text-sm leading-6 ${tier.highlight ? 'text-white/85' : 'text-gray-600'}`}>
                    {tier.highlight
                      ? `适合高频使用，每天可用额度提高到 ${premiumDailyPlays} 次。`
                      : `适合先试试或低频回访，每天保留 ${freeDailyPlays} 次免费互动。`}
                  </p>
                </div>

                <div className={`mt-4 rounded-2xl px-4 py-3 ${tier.highlight ? 'bg-white/12' : 'bg-gray-50'}`}>
                  <p className={`text-xs ${tier.highlight ? 'text-white/70' : 'text-gray-400'}`}>适合场景</p>
                  <p className={`mt-1 text-sm font-semibold ${tier.highlight ? 'text-white' : 'text-gray-800'}`}>
                    {tier.highlight ? '常回来，或同时追多条线' : '只是偶尔回来玩一会儿'}
                  </p>
                </div>

                <ul className="mt-4 flex-1 space-y-2.5">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className={`flex items-start gap-2 text-sm leading-6 ${tier.highlight ? 'text-white/90' : 'text-gray-600'}`}
                    >
                      <span className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${tier.highlight ? 'bg-white/15 text-yellow-200' : 'bg-brand/10 text-brand'}`}>
                        ✓
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={isCurrent ? undefined : handleOpenMembership}
                  disabled={isCurrent || authLoading}
                  className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                    isCurrent
                      ? 'cursor-default bg-gray-100 text-gray-400'
                      : tier.highlight
                        ? 'cursor-pointer bg-white text-brand hover:bg-white/90 disabled:cursor-not-allowed disabled:bg-white/70'
                        : 'cursor-pointer border border-brand/15 bg-brand/5 text-brand hover:bg-brand/10 disabled:cursor-not-allowed disabled:border-brand/10 disabled:bg-brand/5 disabled:text-brand/60'
                  }`}
                >
                  {isCurrent
                    ? '当前方案'
                    : authLoading
                      ? STATUS_COPY.loading.detail
                      : isGuest
                        ? tier.highlight ? '登录后开通' : '登录后体验'
                        : tier.highlight ? '了解开通方式' : '保留免费版'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="rounded-[1.8rem] border border-brand/15 bg-gradient-to-br from-brand/8 via-white to-brand/5 p-5 shadow-sm sm:p-6">
            <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">适合谁</p>
            <h2 className="mt-2 text-xl font-bold text-gray-900">先看自己的使用节奏</h2>
            <p className="mt-2 text-sm leading-6 text-gray-500">
              常回来、长剧情、多线路时更适合高级版；偶尔玩一会儿，先用免费版或补积分就够了。
            </p>

            <div className="mt-4 space-y-3">
              {conversionPanels.map((panel) => (
                <div
                  key={panel.title}
                  className={`rounded-[1.5rem] border px-4 py-4 ${panel.tone === 'brand' ? 'border-brand/15 bg-brand/5' : 'border-gray-200 bg-white'}`}
                >
                  <p className={`text-xs font-semibold tracking-[0.18em] ${panel.tone === 'brand' ? 'text-brand/70' : 'text-gray-400'}`}>
                    {panel.label}
                  </p>
                  <p className="mt-2 text-base font-semibold text-gray-900">{panel.title}</p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{panel.desc}</p>
                  {panel.href ? (
                    <Link
                      href={panel.href}
                      className="mt-4 inline-flex rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      先看积分补给
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-brand/15 bg-white px-4 py-4">
              <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">开通方式</p>
              <p className="mt-2 text-base font-semibold text-gray-900">复制咨询信息，联系开通</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">目前通过人工开通，到账后会自动生效。</p>
            </div>
          </div>

        </div>
      </section>

      <section className="mb-5 overflow-hidden rounded-[1.8rem] border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4 sm:px-6">
          <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">方案对比</p>
            <h2 className="mt-1 text-lg font-bold text-gray-900 sm:text-xl">直接看升级后会多什么</h2>

        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[42rem]">
            <div className="grid grid-cols-[1.15fr_1fr_1fr] border-b border-gray-100 bg-gray-50/80 text-sm font-semibold text-gray-900">
              <div className="px-5 py-3 sm:px-6">维度</div>
              <div className="px-5 py-3 text-center sm:px-6">免费版</div>
              <div className="px-5 py-3 text-center text-brand sm:px-6">高级版</div>
            </div>
            {comparisonRows.map((row) => (
              <div key={row.label} className="grid grid-cols-[1.15fr_1fr_1fr] border-b border-gray-100 text-sm last:border-b-0">
                <div className="px-5 py-3 font-medium text-gray-900 sm:px-6">{row.label}</div>
                <div className="px-5 py-3 text-center text-gray-600 sm:px-6">{row.free}</div>
                <div className="px-5 py-3 text-center font-semibold text-brand sm:px-6">{row.premium}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section ref={contactSectionRef} className="rounded-[1.8rem] border border-brand/15 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">开通方式</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">准备好了，就直接联系开通</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              如果还拿不准，也可以顺手问一句自己更适合会员还是积分。
            </p>
          </div>
          <div className="rounded-[1.4rem] border border-brand/10 bg-brand/5 px-4 py-4 lg:w-[23rem]">
            <p className="text-xs font-semibold tracking-[0.18em] text-brand/70">一句话就够</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">复制联系方式或咨询信息，直接发出去</p>
            <p className="mt-1 text-xs leading-5 text-gray-500">底部按钮已经帮你准备好，不用来回找。</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {contactCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-[1.5rem] border p-4 ${card.tone === 'brand' ? 'border-brand/10 bg-brand/5' : 'border-gray-200 bg-gray-50'}`}
            >
              <p className={`text-xs font-medium uppercase tracking-wide ${card.tone === 'brand' ? 'text-brand/80' : 'text-gray-500'}`}>
                {card.label}
              </p>
              <p className="mt-2 break-all text-base font-semibold text-gray-900">{card.value}</p>
              <button
                type="button"
                onClick={card.onClick}
                className={`mt-4 inline-flex rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${card.tone === 'brand' ? 'bg-white text-brand shadow-sm hover:bg-brand/10' : 'bg-white text-gray-700 shadow-sm hover:bg-gray-100'} cursor-pointer`}
              >
                {card.actionLabel}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-[1.5rem] bg-gray-50 px-4 py-4">
          <p className="text-xs font-semibold tracking-[0.18em] text-gray-500">可直接发送</p>
          <p className="mt-2 text-sm font-medium text-gray-900">{CONTACT_MESSAGE}</p>
          <p className="mt-2 text-xs leading-5 text-gray-500">拿不准时，再补一句你常回来的频率就够了。</p>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handlePrimaryFooterAction}
            disabled={authLoading}
            className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-brand/60 cursor-pointer"
          >
            {footerPrimaryCtaLabel}
          </button>
          <Link
            href="/recharge"
            className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            还是先看积分补给
          </Link>
        </div>
      </section>
    </div>
  );
}
