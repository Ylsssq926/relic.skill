"use client";

import SlideIn from "@/components/animations/SlideIn";
import Avatar from "@/components/ui/Avatar";
import type { ExampleRelic } from "@/data/relics";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/components/providers/I18nProvider";

export interface DemoRelicSelectorProps {
  readonly relics: readonly ExampleRelic[];
  readonly selectedRelic?: ExampleRelic;
  readonly selectedRelicId: string;
  readonly onSelectRelic: (relicId: string) => void;
}

export default function DemoRelicSelector({
  relics,
  selectedRelicId,
  onSelectRelic,
}: DemoRelicSelectorProps) {
  const { dict } = useI18n();

  return (
    <div className="glass-panel rounded-2xl p-5 sticky top-24">
      <div className="mb-5 flex flex-col gap-1.5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground font-display flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-brand" />
          {dict.demo.selectorTitle}
        </h2>
        <p className="text-xs text-foreground-muted leading-relaxed">
          {dict.demo.selectorHint}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {relics.map((relic, index) => {
          const isSelected = selectedRelicId === relic.id;
          return (
            <SlideIn key={relic.id} direction="left" delay={index * 0.08}>
              <button
                type="button"
                onClick={() => onSelectRelic(relic.id)}
                className={`w-full text-left flex items-center gap-3.5 rounded-xl px-3.5 py-3 transition-all duration-200 relative ${
                  isSelected
                    ? "bg-gradient-to-r from-brand/[0.08] to-brand/[0.03] ring-1 ring-brand/25 shadow-sm border-l-2 border-l-brand"
                    : "hover:bg-white/60 hover:shadow-sm border-l-2 border-l-transparent"
                }`}
              >
                <Avatar
                  name={relic.displayName}
                  src={relic.avatarUrl}
                  size="md"
                  className={`shrink-0 ring-2 transition-all duration-200 ${
                    isSelected ? "ring-brand/50 shadow-brand/20 scale-105" : "ring-white/60"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold truncate transition-colors ${
                    isSelected ? "text-brand" : "text-foreground"
                  }`}>
                    {relic.displayName}
                  </p>
                  <p className="text-xs text-foreground-muted truncate mt-0.5">
                    {relic.description}
                  </p>
                  <span className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-all ${
                    isSelected
                      ? "bg-brand/15 text-brand font-semibold"
                      : "bg-background-soft text-foreground-faint"
                  }`}>
                    {dict.types[relic.type as keyof typeof dict.types]}
                  </span>
                </div>
              </button>
            </SlideIn>
          );
        })}
      </div>
    </div>
  );
}
