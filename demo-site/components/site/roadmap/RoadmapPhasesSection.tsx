"use client";

import { CheckCircle2, CircleDot, Circle } from "lucide-react";

import FadeIn from "@/components/animations/FadeIn";
import Section from "@/components/site/SectionBlock";
import SectionHeading from "@/components/site/SectionHeading";
import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";

export default function RoadmapPhasesSection() {
  const { dict } = useI18n();

  return (
    <Section id="roadmap-phases">
      <SectionHeading
        label={dict.roadmap.phasesLabel}
        title={dict.roadmap.phasesTitle}
        description={dict.roadmap.phasesDesc}
      />

      <div className="mt-10 space-y-8">
        {dict.roadmap.phaseData.map((phase, index) => (
          <FadeIn key={phase.stage} delay={index * 0.1}>
            <Surface tone="default" padding="lg" className="relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-brand to-brand/20" />
              <div className="pl-6 space-y-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-brand">
                      {phase.stage}
                    </span>
                    <h3 className="text-xl font-bold text-foreground font-display">
                      {phase.title}
                    </h3>
                  </div>
                  <p className="text-sm text-foreground-muted max-w-sm">
                    {phase.description}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      {dict.roadmap.completed}
                    </div>
                    <ul className="space-y-2">
                      {phase.completed.map((item) => (
                        <li key={item} className="text-sm text-foreground-muted leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-brand">
                      <CircleDot className="h-4 w-4" />
                      {dict.roadmap.inProgress}
                    </div>
                    <ul className="space-y-2">
                      {phase.doing.map((item) => (
                        <li key={item} className="text-sm text-foreground-muted leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground-faint">
                      <Circle className="h-4 w-4" />
                      {dict.roadmap.planned}
                    </div>
                    <ul className="space-y-2">
                      {phase.planned.map((item) => (
                        <li key={item} className="text-sm text-foreground-muted leading-relaxed">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Surface>
          </FadeIn>
        ))}
      </div>
    </Section>
  );
}
