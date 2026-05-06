"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { LOCALE_LABELS, LOCALES } from "@/lib/i18n/config";
import { useI18n } from "@/components/providers/I18nProvider";

export default function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-3 py-1.5 text-xs font-medium text-foreground-muted transition-all hover:border-brand/30 hover:text-foreground"
      >
        <Globe className="h-3.5 w-3.5" aria-hidden="true" />
        {LOCALE_LABELS[locale]}
        <svg className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[10rem] overflow-hidden rounded-xl border border-border bg-surface/95 backdrop-blur-xl shadow-elevated animate-fade-in-up">
          <div className="max-h-72 overflow-y-auto p-1">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLocale(l);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  locale === l
                    ? "bg-brand/10 font-medium text-brand"
                    : "text-foreground-muted hover:bg-background-soft hover:text-foreground"
                }`}
              >
                <span className="text-xs">{LOCALE_LABELS[l]}</span>
                {locale === l && (
                  <svg className="ml-auto h-4 w-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
