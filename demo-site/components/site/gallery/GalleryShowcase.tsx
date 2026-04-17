"use client";

import { useMemo, useState } from "react";

import GalleryEmptyState from "@/components/site/gallery/GalleryEmptyState";
import GalleryGrid from "@/components/site/gallery/GalleryGrid";
import PageShell from "@/components/site/PageShell";
import { exampleRelics } from "@/data/relics";
import { useI18n } from "@/components/providers/I18nProvider";

export default function GalleryShowcase() {
  const { dict } = useI18n();
  const [keyword, setKeyword] = useState("");

  const filteredRelics = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) return exampleRelics;

    return exampleRelics.filter((relic) =>
      relic.displayName.toLowerCase().includes(normalized) ||
      relic.description.toLowerCase().includes(normalized) ||
      relic.detail.toLowerCase().includes(normalized),
    );
  }, [keyword]);

  return (
    <PageShell>
      <div className="mb-8 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand/70">
          {dict.gallery.title}
        </p>
        <h1 className="font-display text-heading-1 text-foreground">
          {dict.gallery.allRelics}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-foreground-muted">
          {dict.gallery.allRelicsDesc}
        </p>
      </div>

      <div className="mb-8 flex items-center gap-4">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder={dict.gallery.searchPlaceholder}
          className="h-11 w-full max-w-md rounded-xl border border-border-strong bg-surface px-4 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-faint focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
        />
        <span className="text-sm text-foreground-faint">
          {dict.gallery.resultCount(filteredRelics.length)}
        </span>
      </div>

      {filteredRelics.length === 0 ? (
        <GalleryEmptyState onReset={() => setKeyword("")} />
      ) : (
        <GalleryGrid relics={filteredRelics} />
      )}
    </PageShell>
  );
}
