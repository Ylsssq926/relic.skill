import { Suspense } from "react";

import DemoExperience from "@/components/site/demo/DemoExperience";
import PageLoading from "@/components/site/PageLoading";

export default function DemoPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <DemoExperience />
    </Suspense>
  );
}
