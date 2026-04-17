"use client";

import Badge from "@/components/ui/Badge";
import Section from "@/components/site/SectionBlock";
import Heading from "@/components/site/SectionHeading";
import Surface from "@/components/site/Surface";
import { RELIC_TYPE_OPTIONS } from "@/lib/constants";
import { useI18n } from "@/components/providers/I18nProvider";

export default function HomeTemplatesSection() {
  const { dict } = useI18n();

  return (
    <Section>
      <Heading
        label={dict.templates.label}
        title={dict.templates.title}
        description={dict.templates.description}
      />

      <div className="mt-12">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {RELIC_TYPE_OPTIONS.map((option) => (
            <Surface
              key={option.value}
              tone="default"
              padding="md"
              className="flex h-full flex-col gap-3.5 card-hover group"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-2xl" aria-hidden="true">
                  {option.emoji}
                </span>
                <Badge type={option.value} className="shrink-0" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{dict.types[option.value as keyof typeof dict.types]}</h3>
              <p className="mt-auto text-sm leading-relaxed text-foreground-muted">
                {dict.typeDesc[option.value as keyof typeof dict.typeDesc]}
              </p>
            </Surface>
          ))}
        </div>
      </div>
    </Section>
  );
}
