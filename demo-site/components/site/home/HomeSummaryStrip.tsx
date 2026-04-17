"use client";

import InfoStrip from "@/components/site/InfoStrip";
import Section from "@/components/site/SectionBlock";
import { getHomeSummaryItems } from "@/components/site/home/data";
import { useI18n } from "@/components/providers/I18nProvider";

export default function HomeSummaryStrip() {
  const { dict } = useI18n();
  const items = getHomeSummaryItems(dict);

  return (
    <Section spacing="sm">
      <InfoStrip items={items} />
    </Section>
  );
}
