"use client";

import Link from "next/link";

import Badge from "@/components/ui/Badge";
import { useI18n } from "@/components/providers/I18nProvider";
import { type ExampleRelic } from "@/data/relics";

export interface HomeExampleCardProps {
  readonly relic: ExampleRelic;
}

export default function HomeExampleCard({ relic }: HomeExampleCardProps) {
  const { dict } = useI18n();

  return (
    <Link href={`/demo?relic=${relic.id}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-surface shadow-soft transition-all duration-[350ms] ease-entrance hover:-translate-y-1 hover:shadow-card">
        <div className="relative border-b border-border/40 bg-warm-gradient px-6 py-5">
          {relic.type === "feishu-cli" && (
            <span className="absolute right-3 top-3 rounded-full bg-blue-500/90 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              🏆 参赛作品
            </span>
          )}
          <div className="relative flex items-start justify-between gap-3">
            <Badge type={relic.type}>{dict.types[relic.type]}</Badge>
            <span className="rounded-full bg-background/80 px-2.5 py-0.5 text-xs text-foreground-faint">
              #{relic.id}
            </span>
          </div>
          <div className="mt-4 space-y-1.5">
            <h3 className="text-xl font-bold text-foreground">{relic.displayName}</h3>
            <p className="text-sm leading-relaxed text-foreground-muted">{relic.description}</p>
          </div>
        </div>
        <div className="flex-1 bg-background px-6 py-5">
          <div className="flex min-h-[9rem] flex-col justify-center gap-3">
            <div className="flex justify-end">
              <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm leading-relaxed text-white">
                {relic.dialogs[0]?.user}
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="h-8 w-8 shrink-0 rounded-full bg-background-soft" aria-hidden="true" />
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm border border-border/60 bg-surface px-4 py-2.5 text-sm leading-relaxed text-foreground-secondary transition-colors duration-300 group-hover:border-brand/25 group-hover:bg-brand/5">
                {relic.dialogs[0]?.relic}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/40 px-6 py-3.5">
          <span className="text-xs text-foreground-faint">{dict.examples.tryChat}</span>
          <span className="text-sm font-semibold text-brand transition-transform duration-300 group-hover:translate-x-1">
            →
          </span>
        </div>
      </div>
    </Link>
  );
}
