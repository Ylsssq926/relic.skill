"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useI18n } from "@/components/providers/I18nProvider";
import { type ExampleRelic } from "@/data/relics";

export interface HomeHeroCarouselProps {
  readonly relics: readonly ExampleRelic[];
}

export default function HomeHeroCarousel({ relics }: HomeHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { dict } = useI18n();

  useEffect(() => {
    if (relics.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % relics.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [relics.length]);

  const activeRelic = useMemo(
    () => relics[activeIndex] ?? relics[0],
    [activeIndex, relics],
  );

  if (!activeRelic || relics.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden bg-background-soft sm:aspect-[16/9]">
        {relics.map((relic, index) => (
          <Image
            key={relic.id}
            src={relic.coverUrl}
            alt={dict.hero.coverAlt(relic.displayName)}
            fill
            sizes="(min-width: 1024px) 32rem, (min-width: 640px) 60vw, 100vw"
            className={`object-cover object-[center_15%] transition-opacity duration-500 ease-entrance ${
              index === activeIndex ? "opacity-100" : "opacity-0"
            }`}
            priority={index === 0}
            loading={index === 0 ? undefined : "eager"}
            unoptimized
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent" />

        <div className="absolute left-5 right-5 top-5 flex items-start justify-between gap-3">
          <Badge type={activeRelic.type}>
            {dict.types[activeRelic.type]}
          </Badge>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={dict.hero.prevExample}
              onClick={() =>
                setActiveIndex(
                  (current) =>
                    (current - 1 + relics.length) % relics.length,
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/28"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={dict.hero.nextExample}
              onClick={() =>
                setActiveIndex((current) => (current + 1) % relics.length)
              }
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/28"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative space-y-4 p-6">
        {relics.map((relic, index) => (
          <div
            key={relic.id}
            className={`transition-opacity duration-300 ${
              index === activeIndex
                ? "opacity-100"
                : "pointer-events-none absolute inset-0 opacity-0"
            }`}
          >
            <div className="flex items-start gap-4">
              <Avatar
                name={relic.displayName}
                src={relic.avatarUrl}
                size="lg"
                className="rounded-full border-[3px] border-surface shadow-medium"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">
                    {relic.displayName}
                  </h3>
                  <span className="rounded-full bg-background-soft px-2.5 py-0.5 text-xs text-foreground-faint">
                    {dict.types[relic.type]}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-foreground-muted">
                  {relic.detail}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-background-soft p-4 text-sm leading-relaxed text-foreground-secondary">
              <span className="font-medium text-foreground">「</span>
              {relic.dialogs[0]?.relic}
              <span className="font-medium text-foreground">」</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 px-6 py-4">
        <div className="flex gap-1.5">
          {relics.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={dict.hero.switchExample(index + 1)}
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? "w-6 bg-brand"
                  : "w-1.5 bg-foreground-faint/50 hover:bg-foreground-muted"
              }`}
            />
          ))}
        </div>

        <Link
          href={`/demo?relic=${activeRelic.id}`}
          className="text-sm font-semibold text-brand transition-colors hover:text-brand-light"
        >
          {dict.hero.tryNow}
        </Link>
      </div>
    </Card>
  );
}
