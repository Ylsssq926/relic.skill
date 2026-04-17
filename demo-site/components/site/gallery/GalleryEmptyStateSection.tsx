"use client";

import { SearchX } from "lucide-react";

import Button from "@/components/ui/Button";
import { ActionGroup, ActionLink } from "@/components/site/ActionGroup";
import SectionBlock from "@/components/site/SectionBlock";
import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";

export interface GalleryEmptyStateSectionProps {
  readonly onReset: () => void;
}

export default function GalleryEmptyStateSection({ onReset }: GalleryEmptyStateSectionProps) {
  const { dict } = useI18n();

  return (
    <SectionBlock spacing="sm">
      <Surface tone="muted" padding="lg" className="flex min-h-[18rem] items-center justify-center text-center">
        <div className="max-w-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-surface text-brand shadow-soft">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xl font-semibold text-foreground">{dict.gallery.emptySectionTitle}</p>
          <p className="mt-3 text-sm leading-7 text-foreground-muted">{dict.gallery.emptySectionHint}</p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="sm" onClick={onReset}>
              {dict.gallery.emptySectionReset}
            </Button>
            <ActionGroup direction="row" className="sm:contents">
              <ActionLink href="/demo" variant="secondary" stretch="none">
                {dict.gallery.emptySectionGoDemo}
              </ActionLink>
            </ActionGroup>
          </div>
        </div>
      </Surface>
    </SectionBlock>
  );
}
