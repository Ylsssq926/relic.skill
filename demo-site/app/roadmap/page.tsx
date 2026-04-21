import type { Metadata } from "next";
import RoadmapShowcase from "@/components/site/roadmap/RoadmapShowcase";

export const metadata: Metadata = {
  title: "产品路线 - relic.skill",
  description: "万物皆可 Relic，但得一步一步来。从 AI 编程助手 Skill 到独立产品,再到生态平台。",
};

export default function RoadmapPage() {
  return <RoadmapShowcase />;
}
