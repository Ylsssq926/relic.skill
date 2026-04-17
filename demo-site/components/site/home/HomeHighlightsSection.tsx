"use client";

import FadeIn from "@/components/animations/FadeIn";
import { Bot, LaptopMinimal, MonitorSmartphone, ShieldCheck, Sparkles, Volume2 } from "lucide-react";

import Section from "@/components/site/SectionBlock";
import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";

export default function HomeHighlightsSection() {
  const { dict } = useI18n();

  const highlights = [
    { icon: ShieldCheck, title: dict.highlights.items.shield.title, description: dict.highlights.items.shield.desc },
    { icon: LaptopMinimal, title: dict.highlights.items.localFirst.title, description: dict.highlights.items.localFirst.desc },
    { icon: MonitorSmartphone, title: dict.highlights.items.multiPlatform.title, description: dict.highlights.items.multiPlatform.desc },
    { icon: Sparkles, title: dict.highlights.items.forge.title, description: dict.highlights.items.forge.desc },
    { icon: Bot, title: dict.highlights.items.engine.title, description: dict.highlights.items.engine.desc },
    { icon: Volume2, title: dict.highlights.items.multiModal.title, description: dict.highlights.items.multiModal.desc },
  ];

  return (
    <Section>
      <Surface tone="muted" padding="lg">
        <div className="mb-10 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand/70">
            {dict.highlights.title}
          </p>
          <h2 className="mt-3 font-display text-heading-2 text-foreground">
            {dict.highlights.subtitle}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <FadeIn key={item.title} delay={index * 0.06}>
                <Surface tone="default" padding="md" className="flex h-full items-start gap-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-foreground-muted">{item.description}</p>
                  </div>
                </Surface>
              </FadeIn>
            );
          })}
        </div>
      </Surface>
    </Section>
  );
}
