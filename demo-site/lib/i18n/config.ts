export type Locale = "zh" | "en" | "ja" | "ko" | "es" | "fr" | "de" | "pt" | "ru" | "tw";

export const LOCALES: readonly Locale[] = [
  "zh", "en", "ja", "ko", "es", "fr", "de", "pt", "ru", "tw",
] as const;

export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "English",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  ru: "Русский",
  tw: "繁體中文",
};

export const DEFAULT_LOCALE: Locale = "zh";

export const FALLBACK_LOCALE: Locale = "en";
