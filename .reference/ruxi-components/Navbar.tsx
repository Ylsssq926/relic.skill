'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { trapFocus } from '@/lib/a11y';
import { getDisplayInitial } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: '首页', icon: '🏠', key: 'home' },
  { href: '/explore?board=adventure', label: '世界冒险', icon: '🌍', key: 'adventure' },
  { href: '/explore?board=character', label: '角色互动', icon: '💬', key: 'character' },
  { href: '/rankings', label: '热榜', icon: '🏆', key: 'rankings' },
] as const;

const MOBILE_TABS = [
  { href: '/', label: '首页', icon: '🏠', key: 'home' },
  { href: '/explore', label: '逛逛', icon: '🔎', key: 'explore' },
  { href: '/rankings', label: '热榜', icon: '🏆', key: 'rankings' },
  { href: '/profile', label: '我的', icon: '🙋', key: 'profile' },
] as const;

function navLinkActive(pathname: string, searchParams: { get(name: string): string | null }, link: (typeof NAV_LINKS)[number]) {
  if (link.key === 'home') {
    return pathname === '/';
  }

  if (link.key === 'adventure') {
    const board = searchParams.get('board') || '';
    return pathname === '/explore' && board !== 'character';
  }

  if (link.key === 'character') {
    return pathname === '/explore' && searchParams.get('board') === 'character';
  }

  const hrefPath = link.href.split('?')[0];
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function mobileTabActive(pathname: string, tab: (typeof MOBILE_TABS)[number]) {
  if (tab.key === 'home') return pathname === '/';
  const hrefPath = tab.href.split('?')[0];
  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function UserAvatar({
  nickname,
  avatarUrl,
  sizeClassName,
  textClassName,
}: {
  nickname: string;
  avatarUrl?: string | null;
  sizeClassName: string;
  textClassName: string;
}) {
  if (avatarUrl) {
    return (
      <span className={`relative overflow-hidden rounded-full bg-gray-100 ${sizeClassName}`}>
        <Image
          src={avatarUrl}
          alt={`${nickname} 的头像`}
          fill
          sizes="32px"
          unoptimized
          className="object-cover"
        />
      </span>
    );
  }

  return (
    <span className={`flex items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-light font-bold text-white ${sizeClassName} ${textClassName}`}>
      {getDisplayInitial(nickname)}
    </span>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHomePage = pathname === '/';
  const isAuthPage = pathname === '/auth' || pathname?.startsWith('/auth/');
  const isFocusPage = isAuthPage;
  const hideMobileBottomNav = isAuthPage || pathname === '/membership' || pathname === '/recharge' || pathname?.startsWith('/play/') || pathname?.startsWith('/world/');
  const showMobileProfileShortcut = hideMobileBottomNav;
  const currentPathWithSearch = `${pathname || '/'}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isHomeTop, setIsHomeTop] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const wasDropdownOpenRef = useRef(false);
  const { user, loading, logout } = useAuth();

  const authHref =
    pathname === '/auth' || pathname?.startsWith('/auth/')
      ? '/auth'
      : `/auth?redirect=${encodeURIComponent(currentPathWithSearch)}`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dropdownOpen) {
        setDropdownOpen(false);
        userMenuButtonRef.current?.focus();
      }

      if (dropdownOpen) {
        trapFocus(dropdownMenuRef.current, e);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const closeFrame = window.requestAnimationFrame(() => {
      setDropdownOpen(false);
    });

    return () => {
      window.cancelAnimationFrame(closeFrame);
    };
  }, [pathname]);

  useEffect(() => {
    if (dropdownOpen) {
      const focusFrame = window.requestAnimationFrame(() => {
        dropdownMenuRef.current?.focus();
      });
      wasDropdownOpenRef.current = true;

      return () => {
        window.cancelAnimationFrame(focusFrame);
      };
    }

    if (wasDropdownOpenRef.current) {
      userMenuButtonRef.current?.focus();
      wasDropdownOpenRef.current = false;
    }
  }, [dropdownOpen]);

  useEffect(() => {
    if (!isHomePage || isFocusPage) {
      setIsHomeTop(false);
      return;
    }

    const handleScroll = () => {
      setIsHomeTop(window.scrollY < 24);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFocusPage, isHomePage]);

  const useHeroNavStyle = isHomePage && !isFocusPage && isHomeTop;
  const navSurfaceClass = useHeroNavStyle
    ? 'border-b border-white/12 bg-[linear-gradient(180deg,rgba(17,36,54,0.34),rgba(59,130,196,0.12))] shadow-none'
    : isFocusPage
      ? 'border-b border-brand/10 bg-white/88 shadow-[0_12px_30px_-24px_rgba(59,130,196,0.35)]'
      : 'border-b border-brand/10 bg-white/84 shadow-[0_14px_36px_-26px_rgba(59,130,196,0.28)]';
  const brandShellClass = useHeroNavStyle
    ? 'rounded-full border border-white/12 bg-white/[0.08] px-3 py-1.5 backdrop-blur-sm'
    : 'rounded-full border border-brand/10 bg-white/80 px-3 py-1.5 shadow-[0_14px_32px_-26px_rgba(59,130,196,0.5)]';
  const brandTitleClass = useHeroNavStyle ? 'text-white' : 'text-slate-950';
  const brandMetaClass = useHeroNavStyle ? 'text-white/58' : 'text-brand/70';
  const desktopNavWrapClass = useHeroNavStyle
    ? 'hidden items-center gap-1 rounded-full border border-white/12 bg-white/[0.06] px-2 py-1 backdrop-blur-sm md:flex'
    : 'hidden items-center gap-1 rounded-full border border-brand/10 bg-white/78 px-2 py-1 shadow-[0_12px_30px_-24px_rgba(59,130,196,0.45)] md:flex';
  const desktopLinkBaseClass = 'tap-feedback inline-flex items-center rounded-full px-3.5 py-2 text-sm transition-all';
  const desktopLinkInactiveClass = useHeroNavStyle
    ? 'font-medium text-white/78 hover:bg-white/[0.08] hover:text-white'
    : 'font-medium text-slate-600 hover:bg-brand/5 hover:text-brand';
  const desktopLinkActiveClass = useHeroNavStyle
    ? 'bg-white/[0.16] font-semibold text-white shadow-[0_10px_24px_-18px_rgba(255,255,255,0.35)]'
    : 'bg-brand/10 font-semibold text-brand shadow-[0_14px_30px_-22px_rgba(59,130,196,0.48)] ring-1 ring-brand/10';
  const desktopUserButtonClass = useHeroNavStyle
    ? 'flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.12] cursor-pointer backdrop-blur-sm'
    : 'flex items-center gap-2 rounded-full border border-brand/10 bg-white/78 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-brand/5 cursor-pointer';
  const desktopGhostButtonClass = useHeroNavStyle
    ? 'tap-feedback rounded-full border border-white/14 bg-white/[0.08] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.12]'
    : 'tap-feedback rounded-full border border-brand/12 bg-white/78 px-4 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-brand/5 hover:text-brand';
  const desktopPrimaryButtonClass = useHeroNavStyle
    ? 'tap-feedback rounded-full border border-white/14 bg-white/[0.12] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.16]'
    : 'tap-feedback rounded-full bg-[linear-gradient(135deg,#3b82c4,#5aa2df)] px-4 py-1.5 text-sm font-medium text-white shadow-[0_16px_36px_-22px_rgba(59,130,196,0.6)] transition-all hover:brightness-[1.03]';
  const mobileProfileClass = useHeroNavStyle
    ? 'inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.08] px-2.5 py-1.5 shadow-sm backdrop-blur-sm'
    : 'inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white/82 px-2.5 py-1.5 shadow-[0_12px_28px_-24px_rgba(59,130,196,0.45)]';
  const mobileCreditsClass = useHeroNavStyle
    ? 'inline-flex min-h-[2.5rem] items-center rounded-full border border-white/14 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm'
    : 'inline-flex min-h-[2.5rem] items-center rounded-full border border-amber-200/80 bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-700 shadow-sm';
  const mobileGhostButtonClass = useHeroNavStyle
    ? 'rounded-full border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-sm'
    : 'rounded-full border border-brand/12 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm';
  const mobilePrimaryButtonClass = useHeroNavStyle
    ? 'rounded-full border border-white/14 bg-white/[0.12] px-4 py-2 text-sm font-semibold text-white shadow-sm backdrop-blur-sm'
    : 'rounded-full bg-[linear-gradient(135deg,#3b82c4,#5aa2df)] px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_36px_-22px_rgba(59,130,196,0.6)]';
  const mobileBottomSurfaceClass = 'fixed inset-x-0 bottom-0 z-50 border-t border-brand/10 bg-white/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl shadow-[0_-12px_32px_-20px_rgba(59,130,196,0.28)]';
  const mobileBottomTabInactiveClass = 'text-slate-500';
  const mobileBottomTabActiveClass = 'bg-[linear-gradient(180deg,rgba(59,130,196,0.14),rgba(59,130,196,0.08))] text-brand shadow-[0_14px_30px_-24px_rgba(59,130,196,0.9)] ring-1 ring-brand/10';

  return (
    <nav className={`fixed left-0 right-0 top-0 z-50 backdrop-blur-md ${navSurfaceClass}`}>
      <div className="mx-auto w-full max-w-[100rem] px-4 sm:px-6 xl:px-8">
        <div className="flex h-14 items-center justify-between sm:h-16">
          <Link href="/" className={`flex items-center gap-3 ${brandShellClass}`}>
            <Image
              src="/luelan-icon.png"
              alt="入戏"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-cover"
              priority
            />
            <div className="flex flex-col leading-none">
              <span className={`text-xl font-bold ${brandTitleClass}`}>入戏</span>
              <span className={`hidden text-[11px] font-medium tracking-[0.18em] sm:inline-block ${brandMetaClass}`}>掠蓝 出品</span>
            </div>
          </Link>

          {!isFocusPage && (
            <div className={desktopNavWrapClass}>
              {NAV_LINKS.map((link) => {
                const active = navLinkActive(pathname, searchParams, link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`${desktopLinkBaseClass} ${active ? desktopLinkActiveClass : desktopLinkInactiveClass}`}
                  >
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="hidden items-center gap-3 md:flex">
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  ref={userMenuButtonRef}
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  aria-label="打开用户菜单"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="menu"
                  aria-controls="user-menu-dropdown"
                  className={desktopUserButtonClass}
                >
                  <UserAvatar
                    nickname={user.nickname}
                    avatarUrl={user.avatar_url}
                    sizeClassName="h-7 w-7"
                    textClassName="text-xs"
                  />
                  <span className="max-w-[8rem] truncate">{user.nickname}</span>
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                    {user.credits} 积分
                  </span>
                </button>
                {dropdownOpen && (
                  <div
                    id="user-menu-dropdown"
                    ref={dropdownMenuRef}
                    role="menu"
                    aria-label="用户菜单"
                    tabIndex={-1}
                    className="absolute right-0 z-50 mt-2 w-48 rounded-2xl border border-brand/10 bg-white/96 py-1.5 shadow-[0_24px_48px_-28px_rgba(59,130,196,0.35)] backdrop-blur-xl"
                  >
                    <Link href="/profile" role="menuitem" className="block rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-brand/5 hover:text-brand" onClick={() => setDropdownOpen(false)}>
                      我的
                    </Link>
                    <Link href="/recharge" role="menuitem" className="block rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-brand/5 hover:text-brand" onClick={() => setDropdownOpen(false)}>
                      积分补给
                    </Link>
                    <Link href="/workshop" role="menuitem" className="block rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-brand/5 hover:text-brand" onClick={() => setDropdownOpen(false)}>
                      创作工坊
                    </Link>
                    <Link href="/rankings" role="menuitem" className="block rounded-xl px-4 py-2.5 text-sm text-slate-700 transition-colors hover:bg-brand/5 hover:text-brand" onClick={() => setDropdownOpen(false)}>
                      热榜
                    </Link>
                    <button onClick={logout} role="menuitem" className="w-full rounded-xl px-4 py-2.5 text-left text-sm text-red-500 transition-colors hover:bg-red-50 cursor-pointer">
                      退出登录
                    </button>
                  </div>
                )}
              </div>
            ) : isAuthPage ? (
              <Link
                href="/"
                className={desktopGhostButtonClass}
              >
                回首页
              </Link>
            ) : (
              <Link
                href={authHref}
                className={desktopPrimaryButtonClass}
              >
                登录
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 md:hidden">
            {loading ? (
              <div className="h-10 w-20 animate-pulse rounded-full bg-gray-100" />
            ) : user ? (
              showMobileProfileShortcut ? (
                <Link
                  href="/profile"
                  className={mobileProfileClass}
                >
                  <UserAvatar
                    nickname={user.nickname}
                    avatarUrl={user.avatar_url}
                    sizeClassName="h-8 w-8"
                    textClassName="text-xs"
                  />
                  <span className={mobileCreditsClass}>
                    {user.credits}
                  </span>
                </Link>
              ) : (
                <span className={mobileCreditsClass}>
                  {user.credits} 积分
                </span>
              )
            ) : isAuthPage ? (
              <Link
                href="/"
                className={mobileGhostButtonClass}
              >
                回首页
              </Link>
            ) : (
              <Link
                href={authHref}
                className={mobilePrimaryButtonClass}
              >
                登录
              </Link>
            )}
          </div>
        </div>
      </div>

      {!hideMobileBottomNav && (
        <div className="md:hidden">
          <div className={mobileBottomSurfaceClass}>
            <div className="mx-auto grid h-[4.9rem] w-full max-w-[100rem] grid-cols-4 gap-1 px-2 py-1.5">
              {MOBILE_TABS.map((tab) => {
                const active = mobileTabActive(pathname, tab);
                return (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[3.6rem] flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-all ${
                      active ? mobileBottomTabActiveClass : mobileBottomTabInactiveClass
                    }`}
                  >
                    <span className="text-[1.15rem] leading-none">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
