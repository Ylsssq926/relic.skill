"use client";

import Link from "next/link";
import { BookOpen, Code2, Heart, MessageCircleMore } from "lucide-react";
import { memo, type HTMLAttributes } from "react";

import Container from "@/components/layout/Container";
import { DOCS_URL, GITHUB_URL, QQ_GROUP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/I18nProvider";

const README_URL = `${GITHUB_URL}/blob/main/README.md`;
const DISCUSSIONS_URL = `${GITHUB_URL}/discussions`;

export type FooterProps = HTMLAttributes<HTMLElement>;

function FooterBase({ className, ...props }: FooterProps) {
  const { dict } = useI18n();

  const groups: readonly { readonly title: string; readonly links: readonly { readonly href: string; readonly label: string; readonly external?: boolean }[] }[] = [
    {
      title: dict.footer.product,
      links: [
        { href: "/", label: dict.footer.home },
        { href: "/demo", label: dict.footer.demo },
        { href: "/gallery", label: dict.footer.gallery },
        { href: "/roadmap", label: dict.footer.roadmap },
      ],
    },
    {
      title: dict.footer.resources,
      links: [
        { href: GITHUB_URL, label: dict.footer.githubRepo, external: true },
        { href: DOCS_URL, label: dict.footer.docsDir, external: true },
        { href: README_URL, label: dict.footer.quickStart, external: true },
      ],
    },
    {
      title: dict.footer.community,
      links: [
        { href: DISCUSSIONS_URL, label: dict.footer.discussions, external: true },
        { href: `https://qm.qq.com/q/${QQ_GROUP}`, label: dict.footer.qqGroup, external: true },
        { href: `${GITHUB_URL}/issues`, label: dict.footer.feedback, external: true },
      ],
    },
  ];

  return (
    <footer className={cn("border-t border-white/40 bg-white/60 backdrop-blur-xl pt-10 pb-8 sm:pt-12", className)} {...props}>
      <Container>
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-sm font-black text-white shadow-brand">
              R
            </span>
            <div>
              <p className="text-base font-bold text-foreground">relic.skill</p>
              <p className="text-xs text-foreground-faint">{dict.site.tagline}</p>
            </div>
          </div>

          <p className="max-w-md text-sm leading-relaxed text-foreground-muted">
            {dict.footer.tagline}
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <div key={group.title}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-brand/70">
                {group.title}
              </h2>
              <ul className="space-y-2.5">
                {group.links.map((link) => (
                  <li key={`${group.title}-${link.label}`}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-foreground-muted transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-6 sm:flex-row">
          <p className="flex items-center gap-1.5 text-xs text-foreground-faint">
            {dict.footer.copyright(new Date().getFullYear(), "掠蓝")}
            <Heart className="inline h-3 w-3 text-warm-relationship" aria-hidden="true" />
          </p>

          <div className="flex items-center gap-3">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:border-brand/30 hover:text-brand"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              {dict.footer.docs}
            </a>
            <a
              href={`https://qm.qq.com/q/${QQ_GROUP}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:border-brand/30 hover:text-brand"
            >
              <MessageCircleMore className="h-3 w-3" aria-hidden="true" />
              {dict.footer.qqGroup}
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:border-brand/30 hover:text-brand"
            >
              <Code2 className="h-3 w-3" aria-hidden="true" />
              GitHub
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}

const Footer = memo(FooterBase);
Footer.displayName = "Footer";

export { Footer };
export default Footer;
