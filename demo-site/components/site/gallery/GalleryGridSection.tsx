"use client";

import Link from "next/link";

import SlideIn from "@/components/animations/SlideIn";
import RelicCard from "@/components/relic/RelicCard";
import { ActionGroup, ActionLink } from "@/components/site/ActionGroup";
import SectionBlock from "@/components/site/SectionBlock";
import SectionHeading from "@/components/site/SectionHeading";
import Surface from "@/components/site/Surface";
import { type ExampleRelic } from "@/data/relics";
import { useI18n } from "@/components/providers/I18nProvider";

export interface GalleryGridSectionProps {
  readonly relics: readonly ExampleRelic[];
}

export default function GalleryGridSection({ relics }: GalleryGridSectionProps) {
  const { dict } = useI18n();

  return (
    <SectionBlock spacing="sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          label={dict.gallery.gridLabel}
          title={dict.gallery.gridTitle}
          description={dict.gallery.gridDesc(relics.length)}
          align="start"
          width="wide"
        />
        <ActionGroup className="lg:justify-end">
          <ActionLink href="/demo">{dict.gallery.goDemo}</ActionLink>
          <ActionLink href="/roadmap" variant="secondary">
            {dict.gallery.seeIteration}
          </ActionLink>
        </ActionGroup>
      </div>

      <Surface tone="default" padding="lg" className="mt-6">
        <div className="grid auto-rows-fr gap-5 md:grid-cols-2 xl:grid-cols-3">
          {relics.map((relic, index) => (
            <SlideIn key={relic.id} direction="bottom" delay={index * 0.05}>
              <Link href={`/demo?relic=${relic.id}`} className="block h-full">
                <RelicCard
                  id={relic.id}
                  displayName={relic.displayName}
                  type={relic.type}
                  description={`${dict.types[relic.type as keyof typeof dict.types]} · ${relic.category} · ${relic.detail}`}
                  coverUrl={relic.coverUrl}
                  avatarUrl={relic.avatarUrl}
                />
              </Link>
            </SlideIn>
          ))}
        </div>
      </Surface>
    </SectionBlock>
  );
}
