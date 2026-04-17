"use client";

import PageShell from "@/components/site/PageShell";
import RoadmapIntroSection from "@/components/site/roadmap/RoadmapIntroSection";
import RoadmapPhasesSection from "@/components/site/roadmap/RoadmapPhasesSection";
import RoadmapFutureSection from "@/components/site/roadmap/RoadmapFutureSection";
import RoadmapVision from "@/components/site/roadmap/RoadmapVision";
import FadeIn from "@/components/animations/FadeIn";
import { useI18n } from "@/components/providers/I18nProvider";

export default function RoadmapShowcase() {
  const { dict } = useI18n();

  return (
    <PageShell>
      <FadeIn>
        <div className="mb-10 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand/70">
            {dict.roadmap.showcaseLabel}
          </p>
          <h1 className="font-display text-heading-1 text-foreground">
            {dict.roadmap.showcaseTitle}
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-foreground-muted">
            {dict.roadmap.showcaseDesc}
          </p>
        </div>
      </FadeIn>

      <RoadmapIntroSection phaseCount={3} futureCount={4} />
      <RoadmapPhasesSection />
      <RoadmapFutureSection />
      <RoadmapVision />
    </PageShell>
  );
}
