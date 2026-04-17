"use client";

import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";

export interface GalleryEmptyStateProps {
  readonly onReset: () => void;
}

export default function GalleryEmptyState({ onReset }: GalleryEmptyStateProps) {
  const { dict } = useI18n();

  return (
    <Surface tone="muted" padding="lg" className="flex min-h-[20rem] flex-col items-center justify-center text-center">
      <div className="space-y-3">
        <p className="text-lg font-semibold text-foreground">{dict.gallery.emptySearchTitle}</p>
        <p className="text-sm text-foreground-muted">{dict.gallery.emptySearchHint}</p>
        <button
          onClick={onReset}
          className="mt-2 text-sm font-medium text-brand transition-colors hover:text-brand-light"
        >
          {dict.gallery.emptySearchReset}
        </button>
      </div>
    </Surface>
  );
}
