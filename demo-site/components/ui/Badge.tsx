"use client";

import { memo, type HTMLAttributes } from "react";

import { RELIC_TYPE_BADGE_STYLES, type RelicTypeKey } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/I18nProvider";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly type: RelicTypeKey;
  readonly subtle?: boolean;
}

function BadgeBase({ type, subtle = false, className, children, ...props }: BadgeProps) {
  const { dict } = useI18n();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        subtle
          ? "border border-border-strong bg-background-soft text-foreground-muted"
          : RELIC_TYPE_BADGE_STYLES[type],
        className,
      )}
      {...props}
    >
      {children ?? dict.types[type]}
    </span>
  );
}

const Badge = memo(BadgeBase);
Badge.displayName = "Badge";

export { Badge };
export default Badge;
