"use client";

import { ArrowRight, Sparkles } from "lucide-react";

import HomeHeroCarousel from "@/components/site/home/HomeHeroCarousel";
import { ActionGroup, ActionLink } from "@/components/site/ActionGroup";
import Section from "@/components/site/SectionBlock";
import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";
import { exampleRelics } from "@/data/relics";
import { DOCS_URL, GITHUB_URL } from "@/lib/constants";

export default function HomeHeroSection() {
  const { dict } = useI18n();

  return (
    <Section spacing="none">
      <Surface tone="warm" padding="hero" className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-warm-human/[0.04] blur-[100px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-warm-pet/[0.05] blur-[80px]"
          aria-hidden="true"
        />

        <div className="relative grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:gap-14 xl:gap-18">
          <div className="max-w-2xl space-y-7">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground-secondary">
              <Sparkles className="h-4 w-4 text-brand" aria-hidden="true" />
              {dict.hero.badge}
            </div>

            <div className="space-y-5">
              <h1 className="font-display text-display leading-[1.08] tracking-tight text-foreground">
                {dict.hero.title}
              </h1>

              <div className="space-y-4 text-base leading-relaxed text-foreground-secondary sm:text-lg">
                <p className="text-lg font-medium text-foreground">
                  {dict.hero.subtitle}
                </p>
                <p>
                  {dict.hero.body}
                </p>
                <p className="text-foreground-muted">
                  {dict.hero.hint}
                </p>
              </div>
            </div>

            <ActionGroup>
              <ActionLink href="/demo" icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
                {dict.hero.tryExample}
              </ActionLink>
              <ActionLink href={GITHUB_URL} variant="secondary">
                GitHub
              </ActionLink>
              <ActionLink href={DOCS_URL} variant="secondary">
                {dict.hero.docs}
              </ActionLink>
            </ActionGroup>
          </div>

          <div className="mx-auto w-full max-w-[32rem] lg:max-w-full">
            <HomeHeroCarousel relics={exampleRelics} />
          </div>
        </div>
      </Surface>
    </Section>
  );
}
