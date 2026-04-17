"use client";

import {
  Ear,
  Globe,
  MessageSquare,
  Mic,
  RefreshCcw,
  Share2,
} from "lucide-react";

import FadeIn from "@/components/animations/FadeIn";
import Section from "@/components/site/SectionBlock";
import SectionHeading from "@/components/site/SectionHeading";
import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";

export default function RoadmapVision() {
  const { dict } = useI18n();

  const visionItems = [
    { icon: Ear, ...dict.roadmap.visionItems.multiModal },
    { icon: Mic, ...dict.roadmap.visionItems.voiceClone },
    { icon: Globe, ...dict.roadmap.visionItems.crossPlatform },
    { icon: Share2, ...dict.roadmap.visionItems.shareEcosystem },
    { icon: MessageSquare, ...dict.roadmap.visionItems.chatIntegration },
    { icon: RefreshCcw, ...dict.roadmap.visionItems.continuousEvolution },
  ];

  return (
    <Section>
      <SectionHeading
        label={dict.roadmap.visionLabel}
        title={dict.roadmap.visionTitle2}
        description={dict.roadmap.visionDesc}
      />

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visionItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <FadeIn key={item.title} delay={index * 0.06}>
              <Surface tone="default" padding="md" className="h-full flex items-start gap-4">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-foreground-muted">{item.desc}</p>
                </div>
              </Surface>
            </FadeIn>
          );
        })}
      </div>
    </Section>
  );
}
