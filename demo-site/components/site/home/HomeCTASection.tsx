"use client";

import { BookOpen, Code2, MessageCircleMore, ShieldCheck, Sparkles } from "lucide-react";

import { ActionGroup, ActionLink } from "@/components/site/ActionGroup";
import Section from "@/components/site/SectionBlock";
import Surface from "@/components/site/Surface";
import { DOCS_URL, GITHUB_URL } from "@/lib/constants";
import { useI18n } from "@/components/providers/I18nProvider";

export default function HomeCTASection() {
  const { dict } = useI18n();

  return (
    <Section>
      <Surface
        tone="elevated"
        padding="lg"
        className="relative overflow-hidden bg-warm-gradient"
      >
        <div
          className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/5 blur-[80px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-warm-human/5 blur-[60px]"
          aria-hidden="true"
        />

        <div className="relative grid gap-8 lg:grid-cols-[1fr_17rem] lg:items-center">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-sm font-medium text-brand">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {dict.cta.badge}
            </div>

            <h2 className="font-display text-heading-1 text-foreground">
              {dict.cta.title}
            </h2>

            <p className="max-w-2xl text-base leading-relaxed text-foreground-secondary">
              {dict.cta.subtitle}
            </p>

            <div className="flex flex-wrap gap-2.5 pt-1">
              {[
                { icon: ShieldCheck, label: dict.cta.tags.ethics },
                { icon: BookOpen, label: dict.cta.tags.docs },
                { icon: Code2, label: dict.cta.tags.community },
                { icon: MessageCircleMore, label: dict.cta.tags.evolution },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-foreground-secondary shadow-soft"
                  >
                    <Icon className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
                    {item.label}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="w-full lg:justify-self-end">
            <ActionGroup direction="column" className="w-full">
              <ActionLink href="/demo" stretch="always" size="lg">
                {dict.cta.tryExample}
              </ActionLink>
              <ActionLink href={`${GITHUB_URL}/blob/main/docs/SETUP.md`} variant="secondary" stretch="always" size="lg">
                {dict.cta.startForge}
              </ActionLink>
              <ActionLink href={DOCS_URL} variant="secondary" stretch="always" size="lg">
                {dict.cta.readDocs}
              </ActionLink>
            </ActionGroup>
          </div>
        </div>
      </Surface>
    </Section>
  );
}
