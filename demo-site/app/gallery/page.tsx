import type { Metadata } from "next";
import dynamic from "next/dynamic";

import PageLoading from "@/components/site/PageLoading";

export const metadata: Metadata = {
  title: "示例广场 - relic.skill",
  description: "浏览所有公开示例 Relic，每一个都是从真实数据中蒸馏出的数字灵魂。点击任意卡片进入对话。",
};

const GalleryShowcase = dynamic(() => import("@/components/site/gallery/GalleryShowcase"), {
  loading: () => <PageLoading />,
});

export default function GalleryPage() {
  return <GalleryShowcase />;
}
