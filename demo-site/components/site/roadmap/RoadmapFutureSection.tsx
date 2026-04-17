"use client";

import { Compass, Map } from "lucide-react";

import FadeIn from "@/components/animations/FadeIn";
import { ActionGroup, ActionLink } from "@/components/site/ActionGroup";
import Section from "@/components/site/SectionBlock";
import SectionHeading from "@/components/site/SectionHeading";
import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";

export default function RoadmapFutureSection() {
  const { dict } = useI18n();

  return (
    <Section>
      <SectionHeading
        label={dict.roadmap.futureLabel}
        title={dict.roadmap.futureTitle}
        description={dict.roadmap.futureDesc}
      />

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {dict.roadmap.futureCards.map((card, index) => (
          <FadeIn key={index} delay={index * 0.06}>
            <Surface tone="default" padding="md" className="h-full">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-sm font-bold text-brand">
                  {index + 1}
                </span>
                <p className="text-sm leading-relaxed text-foreground-muted pt-1">{card}</p>
              </div>
            </Surface>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.3}>
        <Surface tone="elevated" padding="lg" className="mt-10 text-center">
          <h3 className="text-xl font-bold text-foreground font-display">
            {dict.roadmap.futureCtaTitle}
          </h3>
          <p className="mt-3 text-sm text-foreground-muted max-w-lg mx-auto">
            {dict.roadmap.futureCtaDesc}
          </p>
          <ActionGroup className="mt-6 justify-center">
            <ActionLink href="/demo">{dict.roadmap.tryNow}</ActionLink>
            <ActionLink href="/gallery" variant="secondary">{dict.roadmap.browseExamples}</ActionLink>
          </ActionGroup>
        </Surface>
      </FadeIn>
    </Section>
  );
}
