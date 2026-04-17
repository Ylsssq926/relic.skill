import type { LucideIcon } from "lucide-react";
import {
  HeartHandshake,
  LaptopMinimal,
  MonitorSmartphone,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

import type { InfoStripItem } from "@/components/site/InfoStrip";
import type { Dictionary } from "@/lib/i18n/dictionaries/zh";

export interface SoulDimension {
  readonly title: string;
  readonly summary: string;
  readonly detail: string;
}

export interface FeatureCard {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly points: readonly string[];
}

export interface TechHighlight {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
}

export function getHomeSummaryItems(dict: Dictionary): readonly InfoStripItem[] {
  return [
    {
      key: "examples",
      title: dict.site.tagline,
      description: dict.hero.hint,
    },
    {
      key: "templates",
      title: dict.homeData.templateCount,
      description: dict.typeDesc.human + "、" + dict.typeDesc.pet + "……" + dict.homeData.templateDesc,
    },
    {
      key: "open-source",
      title: dict.highlights.items.shield.title,
      description: dict.highlights.items.shield.desc,
    },
  ];
}

export function getSoulDimensions(dict: Dictionary): readonly SoulDimension[] {
  return [
    {
      title: dict.features.items.cognition.title,
      summary: dict.features.items.cognition.desc.split("—")[0]?.trim() ?? "",
      detail: dict.features.items.cognition.desc.replace(/^[^—]*—\s*/, ""),
    },
    {
      title: dict.features.items.expression.title,
      summary: dict.features.items.expression.desc.split("—")[0]?.trim() ?? "",
      detail: dict.features.items.expression.desc.replace(/^[^—]*—\s*/, ""),
    },
    {
      title: dict.features.items.behavior.title,
      summary: dict.features.items.behavior.desc.split("—")[0]?.trim() ?? "",
      detail: dict.features.items.behavior.desc.replace(/^[^—]*—\s*/, ""),
    },
    {
      title: dict.features.items.emotion.title,
      summary: dict.features.items.emotion.desc.split("—")[0]?.trim() ?? "",
      detail: dict.features.items.emotion.desc.replace(/^[^—]*—\s*/, ""),
    },
  ];
}

export function getFeatureCards(dict: Dictionary): readonly FeatureCard[] {
  return [
    {
      icon: Sparkles,
      title: dict.highlights.items.forge.title,
      description: dict.highlights.items.forge.desc,
      points: [
        dict.features.items.cognition.desc,
        dict.features.items.expression.desc,
        dict.features.items.behavior.desc,
      ],
    },
    {
      icon: HeartHandshake,
      title: dict.highlights.items.shield.title,
      description: dict.highlights.items.shield.desc,
      points: [...dict.homeData.shieldPoints],
    },
    {
      icon: Workflow,
      title: dict.highlights.items.engine.title,
      description: dict.highlights.items.engine.desc,
      points: [...dict.homeData.enginePoints],
    },
  ];
}

export function getTechHighlights(dict: Dictionary): readonly TechHighlight[] {
  return [
    {
      icon: ShieldCheck,
      title: dict.homeData.openSource.title,
      description: dict.homeData.openSource.desc,
    },
    {
      icon: LaptopMinimal,
      title: dict.homeData.localFirst.title,
      description: dict.homeData.localFirst.desc,
    },
    {
      icon: MonitorSmartphone,
      title: dict.homeData.multiPlatform.title,
      description: dict.homeData.multiPlatform.desc,
    },
  ];
}
