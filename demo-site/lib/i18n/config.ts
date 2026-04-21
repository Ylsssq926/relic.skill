export type Locale = "zh" | "en" | "ja" | "ko" | "es" | "fr" | "de" | "pt" | "ru" | "tw";

export const LOCALES: readonly Locale[] = [
  "zh",  // ✅ 完整
  "en",  // ✅ 完整(需 editorial pass)
  "ja",  // ⚠️ 部分翻译
  "ko",  // ⚠️ 部分翻译
  "es",  // ⚠️ 部分翻译
  "fr",  // ⚠️ 部分翻译
  "de",  // ⚠️ 部分翻译
  "pt",  // ⚠️ 部分翻译
  "ru",  // ⚠️ 部分翻译
  "tw",  // ✅ 完整
] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語 (β)",
  ko: "한국어 (β)",
  es: "Español (β)",
  fr: "Français (β)",
  de: "Deutsch (β)",
  pt: "Português (β)",
  ru: "Русский (β)",
  tw: "繁體中文",
};

export const DEFAULT_LOCALE: Locale = "zh";

export const FALLBACK_LOCALE: Locale = "en";
