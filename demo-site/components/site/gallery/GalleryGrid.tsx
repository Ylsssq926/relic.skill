"use client";

import Link from "next/link";

import SlideIn from "@/components/animations/SlideIn";
import RelicCard from "@/components/relic/RelicCard";
import Surface from "@/components/site/Surface";
import type { ExampleRelic } from "@/data/relics";
import { useI18n } from "@/components/providers/I18nProvider";

export interface GalleryGridProps {
  readonly relics: readonly ExampleRelic[];
}

export default function GalleryGrid({ relics }: GalleryGridProps) {
  const { dict } = useI18n();

  return (
    <Surface tone="default" padding="md">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {relics.map((relic, index) => (
          <SlideIn key={relic.id} direction="bottom" delay={index * 0.06}>
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
  );
}
