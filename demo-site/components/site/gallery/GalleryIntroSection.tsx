"use client";

import { ArrowRight, Compass, Map } from "lucide-react";

import PageIntro from "@/components/site/PageIntro";
import { ActionGroup, ActionLink } from "@/components/site/ActionGroup";
import InfoStrip from "@/components/site/InfoStrip";
import SectionBlock from "@/components/site/SectionBlock";
import { useI18n } from "@/components/providers/I18nProvider";

export interface GalleryIntroSectionProps {
  readonly totalRelics: number;
  readonly totalTypes: number;
  readonly resultCount: number;
}

export default function GalleryIntroSection({ totalRelics, totalTypes, resultCount }: GalleryIntroSectionProps) {
  const { dict } = useI18n();

  const introItems = [
    {
      key: "gallery-total",
      title: dict.gallery.introTotalTitle,
      description: dict.gallery.introTotalDesc(totalRelics),
    },
    {
      key: "gallery-result",
      title: dict.gallery.introResultTitle,
      description: dict.gallery.introResultDesc(resultCount),
    },
    {
      key: "gallery-types",
      title: dict.gallery.introTypeTitle,
      description: dict.gallery.introTypeDesc(totalTypes),
    },
  ] as const;

  return (
    <>
      <PageIntro
        label={dict.gallery.introLabel}
        title={dict.gallery.introTitle}
        description={
          <>
            <p>{dict.gallery.introDesc1}</p>
            <p>{dict.gallery.introDesc2}</p>
          </>
        }
      >
        <div className="space-y-4">
          <ActionGroup>
            <ActionLink href="#gallery-filters" icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}>
              {dict.gallery.startFilter}
            </ActionLink>
            <ActionLink href="/demo" variant="secondary" icon={<Compass className="h-4 w-4" aria-hidden="true" />}>
              {dict.gallery.goExperience}
            </ActionLink>
            <ActionLink href="/roadmap" variant="secondary" icon={<Map className="h-4 w-4" aria-hidden="true" />}>
              {dict.gallery.seeRoadmap}
            </ActionLink>
          </ActionGroup>
        </div>
      </PageIntro>

      <SectionBlock spacing="sm">
        <InfoStrip items={introItems} />
      </SectionBlock>
    </>
  );
}
