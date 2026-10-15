"use client";

import { ArrowUpRight, BriefcaseBusiness, Code2 } from "lucide-react";

import { ActionLink } from "@/components/site/ActionGroup";
import FadeIn from "@/components/animations/FadeIn";
import Section from "@/components/site/SectionBlock";
import Surface from "@/components/site/Surface";
import { GITHUB_URL } from "@/lib/constants";
import { useI18n } from "@/components/providers/I18nProvider";

const COMMERCIAL_LICENSE_URL = `${GITHUB_URL}/blob/main/COMMERCIAL-LICENSE.md`;

export default function HomeEditionSection() {
  const { dict } = useI18n();
  const editions = [
    {
      icon: Code2,
      title: dict.edition.openTitle,
      description: dict.edition.openDesc,
      href: GITHUB_URL,
      cta: dict.edition.openCta,
    },
    {
      icon: BriefcaseBusiness,
      title: dict.edition.commercialTitle,
      description: dict.edition.commercialDesc,
      href: COMMERCIAL_LICENSE_URL,
      cta: dict.edition.commercialCta,
    },
  ];

  return (
    <Section>
      <div className="mb-10 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand/70">{dict.edition.label}</p>
        <h2 className="mt-3 font-display text-heading-2 text-foreground">{dict.edition.title}</h2>
        <p className="mt-4 text-base leading-relaxed text-foreground-muted">{dict.edition.subtitle}</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {editions.map((edition, index) => {
          const Icon = edition.icon;
          return (
            <FadeIn key={edition.title} delay={index * 0.08}>
              <Surface tone={index === 1 ? "elevated" : "default"} padding="md" className="group flex h-full flex-col gap-5 transition-transform duration-300 hover:-translate-y-1">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">{edition.title}</h3>
                  <p className="text-sm leading-relaxed text-foreground-muted">{edition.description}</p>
                </div>
                <ActionLink href={edition.href} variant={index === 1 ? "primary" : "secondary"} icon={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}>
                  {edition.cta}
                </ActionLink>
              </Surface>
            </FadeIn>
          );
        })}
      </div>
    </Section>
  );
}
