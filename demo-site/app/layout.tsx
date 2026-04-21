import type { Metadata, Viewport } from "next";

import "./globals.css";
import DynamicBackground from "@/components/animations/DynamicBackground";
import { I18nProvider } from "@/components/providers/I18nProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://relic.luelan.online"),
  title: "relic.skill - 万物皆可 Relic",
  description:
    "把重要的人、宠物、关系、团队、地方、时刻,从散落的数据碎片中锻造成可交互的数字灵魂。",
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
    title: "relic.skill - 万物皆可 Relic",
    description: "把你在乎的东西锻造成可交互的数字灵魂。",
    url: "https://relic.luelan.online",
    siteName: "relic.skill",
    locale: "zh_CN",
    type: "website",
    images: [{ url: "/images/relic-og.jpg", width: 1200, height: 630, alt: "relic.skill" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "relic.skill - 万物皆可 Relic",
    description: "把你在乎的东西锻造成可交互的数字灵魂。",
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
    <html lang="zh-CN">
      <body className="min-h-screen bg-background text-foreground antialiased relative z-0">
        <I18nProvider>
          <DynamicBackground />
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
