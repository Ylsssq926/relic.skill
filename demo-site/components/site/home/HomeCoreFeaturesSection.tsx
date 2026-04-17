"use client";

import { Sparkles } from "lucide-react";

import FadeIn from "@/components/animations/FadeIn";
import Section from "@/components/site/SectionBlock";
import Heading from "@/components/site/SectionHeading";
import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";
import { getFeatureCards, getSoulDimensions } from "@/components/site/home/data";

export default function HomeCoreFeaturesSection() {
  const { dict } = useI18n();
  const soulDimensions = getSoulDimensions(dict);
  const featureCards = getFeatureCards(dict);

  return (
    <Section>
      <Heading
        label={dict.features.title}
        title={dict.features.subtitle}
      />

      <div className="mt-12 space-y-10">
        <Surface tone="default" padding="md">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand/70">
                {dict.features.title}
              </p>
              <h3 className="font-display text-heading-3 text-foreground">
                {dict.features.subtitle}
              </h3>
            </div>
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {soulDimensions.map((item) => (
              <FadeIn key={item.title}>
                <Surface tone="muted" padding="sm" className="h-full">
                  <p className="text-sm font-semibold uppercase tracking-[0.1em] text-brand/70">
                    {item.title}
                  </p>
                  <h4 className="mt-1.5 text-lg font-bold text-foreground">
                    {item.summary}
                  </h4>
                  <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
                    {item.detail}
                  </p>
                </Surface>
              </FadeIn>
            ))}
          </div>

          <Surface tone="muted" padding="sm" className="mt-4">
            <p className="text-sm leading-relaxed text-foreground-muted italic">
              {dict.hero.hint}
            </p>
          </Surface>
        </Surface>

        <div className="grid gap-5 md:grid-cols-3">
          {featureCards.map((item, index) => {
            const Icon = item.icon;

            return (
              <FadeIn key={item.title} delay={index * 0.08}>
                <Surface tone="default" padding="md" className="card-hover flex h-full flex-col gap-4">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-foreground-muted">
                      {item.description}
                    </p>
                  </div>
                  <ul className="space-y-2 text-sm leading-relaxed text-foreground-muted">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand/50" aria-hidden="true" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </Surface>
              </FadeIn>
            );
          })}
        </div>
      </div>
    </Section>
  );
}
