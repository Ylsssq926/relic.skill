"use client";

import HomeExampleCard from "@/components/site/home/HomeExampleCard";
import Section from "@/components/site/SectionBlock";
import Heading from "@/components/site/SectionHeading";
import { useI18n } from "@/components/providers/I18nProvider";
import { exampleRelics } from "@/data/relics";

export default function HomeExamplesSection() {
  const { dict } = useI18n();

  return (
    <Section>
      <Heading
        label={dict.examples.title}
        title={dict.examples.subtitle}
      />

      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {exampleRelics.map((relic) => (
          <HomeExampleCard key={relic.id} relic={relic} />
        ))}
      </div>
    </Section>
  );
}
