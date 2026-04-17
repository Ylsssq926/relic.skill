"use client";

import { memo } from "react";

import Surface from "@/components/site/Surface";
import { useI18n } from "@/components/providers/I18nProvider";

export interface PageLoadingProps {
  readonly title?: string;
  readonly description?: string;
}

function PageLoadingBase({ title, description }: PageLoadingProps) {
  const { dict } = useI18n();

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Surface tone="muted" padding="lg" className="max-w-md text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-brand/10" />
        <p className="text-lg font-semibold text-foreground">{title ?? dict.loading.title}</p>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            {description}
          </p>
        ) : description === undefined ? (
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            {dict.loading.description}
          </p>
        ) : null}
      </Surface>
    </div>
  );
}

const PageLoading = memo(PageLoadingBase);
PageLoading.displayName = "PageLoading";

export { PageLoading };
export default PageLoading;
