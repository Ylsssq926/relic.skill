"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n/dictionaries/zh";

interface I18nContextValue {
  readonly locale: Locale;
  readonly dict: Dictionary;
  readonly setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const dict = getDictionary(locale);

  const applyDocumentLocale = useCallback((newLocale: Locale) => {
    document.documentElement.lang = newLocale === 'zh' ? 'zh-CN' : newLocale === 'tw' ? 'zh-TW' : newLocale;
  }, []);

  useEffect(() => {
    let saved: Locale | null = null;
    try {
      saved = localStorage.getItem('relic-locale') as Locale | null;
    } catch {
      // localStorage can be unavailable in restricted browsing modes.
    }

    if (saved && LOCALES.includes(saved)) {
      const frame = window.requestAnimationFrame(() => {
        setLocaleState(saved);
        applyDocumentLocale(saved);
      });
      return () => window.cancelAnimationFrame(frame);
    }

    applyDocumentLocale(DEFAULT_LOCALE);
  }, [applyDocumentLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('relic-locale', newLocale);
    } catch {
      // Keep in-memory locale changes working even when persistence is blocked.
    }
    applyDocumentLocale(newLocale);
  }, [applyDocumentLocale]);

  return (
    <I18nContext.Provider value={{ locale, dict, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
