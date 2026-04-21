import type { Metadata } from "next";
import { Suspense } from "react";

import DemoExperience from "@/components/site/demo/DemoExperience";
import PageLoading from "@/components/site/PageLoading";

export const metadata: Metadata = {
  title: "体验示例 Relic - relic.skill",
  description: "无需上传素材，直接与预设的数字灵魂对话。奶奶、猫咪、创业团队、赛博导师——选一个开始聊。",
};

export default function DemoPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <DemoExperience />
    </Suspense>
  );
}
