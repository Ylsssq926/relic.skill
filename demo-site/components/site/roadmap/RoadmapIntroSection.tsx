"use client";

import { Compass, Map } from "lucide-react";

import PageIntro from "@/components/site/PageIntro";
import { ActionGroup, ActionLink } from "@/components/site/ActionGroup";
import InfoStrip from "@/components/site/InfoStrip";
import SectionBlock from "@/components/site/SectionBlock";
import { useI18n } from "@/components/providers/I18nProvider";

export interface RoadmapIntroSectionProps {
  readonly phaseCount: number;
  readonly futureCount: number;
}

export default function RoadmapIntroSection({ phaseCount, futureCount }: RoadmapIntroSectionProps) {
  const { dict } = useI18n();

  const introItems = [
    {
      key: "roadmap-phases",
      title: dict.roadmap.introPhaseTitle,
      description: dict.roadmap.introPhaseDesc(phaseCount),
    },
    {
      key: "roadmap-status",
      title: dict.roadmap.introStatusTitle,
      description: dict.roadmap.introStatusDesc,
    },
    {
      key: "roadmap-future",
      title: dict.roadmap.introFutureTitle,
      description: dict.roadmap.introFutureDesc(futureCount),
    },
  ] as const;

  return (
    <>
      <PageIntro
        label={dict.roadmap.introLabel}
        title={dict.roadmap.introTitle}
        description={dict.roadmap.introDesc}
      >
        <ActionGroup>
          <ActionLink href="/demo" icon={<Compass className="h-4 w-4" aria-hidden="true" />}>
            {dict.roadmap.introGoDemo}
          </ActionLink>
          <ActionLink href="/gallery" variant="secondary" icon={<Map className="h-4 w-4" aria-hidden="true" />}>
            {dict.roadmap.introGoGallery}
          </ActionLink>
          <ActionLink href="#roadmap-phases" variant="secondary">
            {dict.roadmap.introSeeDetails}
          </ActionLink>
        </ActionGroup>
      </PageIntro>

      <SectionBlock spacing="sm">
        <InfoStrip items={introItems} />
      </SectionBlock>
    </>
  );
}
