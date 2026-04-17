import HomeCoreFeaturesSection from "@/components/site/home/HomeCoreFeaturesSection";
import HomeCTASection from "@/components/site/home/HomeCTASection";
import HomeExamplesSection from "@/components/site/home/HomeExamplesSection";
import HomeHeroSection from "@/components/site/home/HomeHeroSection";
import HomeHighlightsSection from "@/components/site/home/HomeHighlightsSection";
import HomeSummaryStrip from "@/components/site/home/HomeSummaryStrip";
import HomeTemplatesSection from "@/components/site/home/HomeTemplatesSection";
import PageShell from "@/components/site/PageShell";

export default function Page() {
  return (
    <PageShell>
      <HomeHeroSection />
      <HomeSummaryStrip />
      <HomeCoreFeaturesSection />
      <HomeTemplatesSection />
      <HomeExamplesSection />
      <HomeHighlightsSection />
      <HomeCTASection />
    </PageShell>
  );
}
