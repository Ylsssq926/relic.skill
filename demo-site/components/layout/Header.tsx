"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { memo, useEffect, useState, type HTMLAttributes } from "react";

import Container from "@/components/layout/Container";
import LocaleSwitcher from "@/components/ui/LocaleSwitcher";
import { useI18n } from "@/components/providers/I18nProvider";
import { GITHUB_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type HeaderProps = HTMLAttributes<HTMLElement>;

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly external?: boolean;
}

/**
 * Header — 全局导航栏
 *
 * 设计：浮动胶囊式，滚动后增加阴影
 * 响应式：lg 以下显示汉堡菜单
 */
function HeaderBase({ className, ...props }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { dict } = useI18n();

  const navItems: readonly NavItem[] = [
    { href: "/", label: dict.nav.home },
    { href: "/demo", label: dict.nav.demo },
    { href: "/gallery", label: dict.nav.gallery },
    { href: "/roadmap", label: dict.nav.roadmap },
    { href: GITHUB_URL, label: "GitHub", external: true },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn("sticky top-0 z-50 pt-3 sm:pt-4", className)}
      {...props}
    >
      <Container>
        <div
          className={cn(
            "flex items-center justify-between gap-4 rounded-2xl border px-4 py-2.5 transition-all duration-300 sm:px-5",
            scrolled
              ? "border-border-strong bg-surface/95 shadow-medium backdrop-blur-md"
              : "border-transparent bg-transparent",
          )}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5"
            onClick={() => setOpen(false)}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-sm font-black text-white">
              R
            </span>
            <div className="hidden sm:block">
              <p className="text-base font-bold leading-tight text-foreground">
                relic.skill
              </p>
              <p className="text-[11px] leading-tight text-foreground-faint">
                {dict.site.tagline}
              </p>
            </div>
          </Link>

          {/* 桌面导航 */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const content = (
                <span className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-foreground-muted transition-colors hover:bg-background-soft hover:text-foreground">
                  {item.label}
                </span>
              );

              return item.external ? (
                <a key={item.href} href={item.href} target="_blank" rel="noreferrer">
                  {content}
                </a>
              ) : (
                <Link key={item.href} href={item.href}>
                  {content}
                </Link>
              );
            })}
          </nav>

          {/* CTA 按钮（桌面） */}
          <div className="hidden lg:flex items-center gap-3">
            <LocaleSwitcher />
            <Link
              href="/demo"
              className="inline-flex h-9 items-center rounded-full bg-brand px-4 text-sm font-semibold text-white shadow-brand transition-all duration-300 hover:-translate-y-0.5"
            >
              {dict.nav.tryNow}
            </Link>
          </div>

          {/* 移动端菜单按钮 */}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground lg:hidden"
            aria-label={open ? dict.nav.closeMenu : dict.nav.openMenu}
            onClick={() => setOpen((prev) => !prev)}
          >
            {open ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* 移动端下拉菜单 */}
        <div
          className={cn(
            "overflow-hidden transition-all duration-300 lg:hidden",
            open ? "max-h-80 opacity-100 pb-3" : "max-h-0 opacity-0",
          )}
        >
          <div className="rounded-xl border border-border-strong bg-surface p-2 shadow-medium">
            {navItems.map((item) =>
              item.external ? (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-lg px-4 py-2.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-background-soft hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-4 py-2.5 text-sm font-medium text-foreground-secondary transition-colors hover:bg-background-soft hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ),
            )}
            <Link
              href="/demo"
              className="mt-2 block rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              {dict.nav.tryNow}
            </Link>
          </div>
        </div>
      </Container>
    </header>
  );
}

const Header = memo(HeaderBase);
Header.displayName = "Header";

export { Header };
export default Header;
