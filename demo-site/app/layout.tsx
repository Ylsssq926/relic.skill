import type { Metadata, Viewport } from "next";

import "./globals.css";
import DynamicBackground from "@/components/animations/DynamicBackground";
import { I18nProvider } from "@/components/providers/I18nProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://relic.luelanai.com"),
  title: "relic.skill — GitHub for Souls",
  description:
    "A local-first, consent-aware engine for turning memories, people, pets, teams, and expertise into auditable digital Relics.",
  keywords: [
    "数字陪伴",
    "记忆整理",
    "数字灵魂",
    "纪念体验",
    "万物永生",
    "AI 多模态",
  ],
  authors: [{ name: "掠蓝" }],
  openGraph: {
    title: "relic.skill — GitHub for Souls",
    description: "Turn what matters into an auditable digital Relic — local-first, consent-aware, and built for real conversations.",
    url: "https://relic.luelanai.com",
    siteName: "relic.skill",
    locale: "en_US",
    type: "website",
    images: [{ url: "/images/relic-og.jpg", width: 1200, height: 630, alt: "relic.skill" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "relic.skill — GitHub for Souls",
    description: "Turn what matters into an auditable digital Relic — local-first, consent-aware, and built for real conversations.",
    images: ["/images/relic-og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF8F5",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* TODO: 当实现路由级 i18n 时，lang 应该动态化 */}
      <body className="min-h-screen bg-background text-foreground antialiased relative z-0">
        <I18nProvider>
          <DynamicBackground />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
