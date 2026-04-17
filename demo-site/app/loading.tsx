"use client";

import { useI18n } from "@/components/providers/I18nProvider";

export default function Loading() {
  const { dict } = useI18n();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-6">
      <div className="space-y-3">
        <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-brand/10" />
        <p className="text-lg font-semibold text-foreground">{dict.loading.title}</p>
        <p className="text-sm text-foreground-muted">{dict.loading.description}</p>
      </div>
    </div>
  );
}
