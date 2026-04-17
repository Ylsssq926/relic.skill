"use client";

import Link from "next/link";

import { useI18n } from "@/components/providers/I18nProvider";

export default function NotFound() {
  const { dict } = useI18n();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-6">
      <div className="space-y-4">
        <p className="text-6xl font-black text-brand/20">404</p>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand/70">
          {dict.notFound.label}
        </p>
        <h1 className="text-2xl font-bold text-foreground font-display">
          {dict.notFound.title}
        </h1>
        <p className="text-sm text-foreground-muted max-w-md mx-auto">
          {dict.notFound.description}
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          {dict.notFound.goHome}
        </Link>
      </div>
    </div>
  );
}
