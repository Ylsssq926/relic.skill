"use client";

import Button from "@/components/ui/Button";
import SectionBlock from "@/components/site/SectionBlock";
import SectionHeading from "@/components/site/SectionHeading";
import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";

export interface GalleryFilterOption {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface GalleryFiltersSectionProps {
  readonly filter: string;
  readonly keyword: string;
  readonly resultCount: number;
  readonly options: readonly GalleryFilterOption[];
  readonly onFilterChange: (value: string) => void;
  readonly onKeywordChange: (value: string) => void;
  readonly onReset: () => void;
}

export default function GalleryFiltersSection({
  filter,
  keyword,
  resultCount,
  options,
  onFilterChange,
  onKeywordChange,
  onReset,
}: GalleryFiltersSectionProps) {
  const { dict } = useI18n();
  const hasActiveFilters = filter !== "all" || keyword.trim().length > 0;

  return (
    <SectionBlock spacing="sm" id="gallery-filters">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading
          label={dict.gallery.filterLabel}
          title={dict.gallery.filterTitle}
          description={dict.gallery.filterResultCount(resultCount)}
          align="start"
          width="wide"
        />
        {hasActiveFilters ? (
          <Button size="sm" variant="ghost" onClick={onReset}>
            {dict.gallery.clearFilter}
          </Button>
        ) : (
          <div className="inline-flex items-center rounded-full border border-border/60 bg-surface px-4 py-2 text-sm text-foreground-muted shadow-soft">
            {dict.gallery.defaultShowAll}
          </div>
        )}
      </div>

      <Surface tone="default" padding="lg" className="mt-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3.5">
            <p className="text-sm font-medium text-foreground-muted">{dict.gallery.filterByType}</p>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => (
                <Button
                  key={option.value}
                  size="sm"
                  variant={filter === option.value ? "primary" : "secondary"}
                  onClick={() => onFilterChange(option.value)}
                >
                  {option.label}
                  <span className="text-[11px] opacity-70">{option.count}</span>
                </Button>
              ))}
            </div>
          </div>

          <label className="block xl:w-[21rem]">
            <span className="mb-2 block text-sm font-medium text-foreground-muted">{dict.gallery.keywordSearch}</span>
            <input
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder={dict.gallery.searchPlaceholder}
              className="h-12 w-full rounded-2xl border border-border/60 bg-surface px-4 text-sm text-foreground outline-none placeholder:text-foreground-muted/50 focus:border-brand/40 focus:ring-2 focus:ring-brand/20"
            />
          </label>
        </div>
      </Surface>
    </SectionBlock>
  );
}
