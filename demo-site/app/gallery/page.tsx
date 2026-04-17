import dynamic from "next/dynamic";

import PageLoading from "@/components/site/PageLoading";

const GalleryShowcase = dynamic(() => import("@/components/site/gallery/GalleryShowcase"), {
  loading: () => <PageLoading />,
});

export default function GalleryPage() {
  return <GalleryShowcase />;
}
