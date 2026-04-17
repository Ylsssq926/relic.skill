"use client";

import Image from "next/image";
import { memo, type HTMLAttributes } from "react";

import Surface from "@/components/site/Surface";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import { RELIC_TYPES, type RelicTypeKey } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/providers/I18nProvider";

export interface RelicCardProps extends HTMLAttributes<HTMLDivElement> {
  readonly id: string;
  readonly displayName: string;
  readonly type: string;
  readonly description: string;
  readonly coverUrl: string;
  readonly avatarUrl: string;
  readonly onClick?: () => void;
}

function isRelicTypeKey(value: string): value is RelicTypeKey {
  return value in RELIC_TYPES;
}

function RelicCardInner({
  id,
  displayName,
  resolvedType,
  description,
  coverUrl,
  avatarUrl,
}: {
  readonly id: string;
  readonly displayName: string;
  readonly resolvedType: RelicTypeKey;
  readonly description: string;
  readonly coverUrl: string;
  readonly avatarUrl: string;
}) {
  const { dict } = useI18n();

  return (
    <>
      <div className="relative aspect-[1.8/1] shrink-0 overflow-hidden bg-background-soft">
        <Image
          src={coverUrl}
          alt={`${displayName} 的封面图`}
          fill
          sizes="(min-width: 1280px) 360px, (min-width: 768px) 50vw, 100vw"
          loading="lazy"
          decoding="async"
          className="object-cover transition-transform duration-500 ease-entrance group-hover:scale-[1.04]"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/20 via-transparent to-transparent" />
        <div className="absolute left-4 top-4">
          <Badge type={resolvedType}>{dict.types[resolvedType]}</Badge>
        </div>
      </div>

      {/* 信息区 */}
      <div className="relative flex flex-col px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
        <div className="-mt-6 mb-3 shrink-0">
          <Avatar
            name={displayName}
            src={avatarUrl}
            size="lg"
            className="rounded-full border-[3px] border-surface shadow-medium"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-foreground">{displayName}</h3>
            <span className="shrink-0 rounded-full bg-background-soft px-2 py-0.5 text-[11px] text-foreground-faint">
              #{id}
            </span>
          </div>
          <p className="min-h-[4rem] text-sm leading-relaxed text-foreground-muted">{description}</p>
        </div>
      </div>
    </>
  );
}

function RelicCardBase({
  id,
  displayName,
  type,
  description,
  coverUrl,
  avatarUrl,
  onClick,
  className,
  ...props
}: RelicCardProps) {
  const resolvedType: RelicTypeKey = isRelicTypeKey(type) ? type : "human";

  return (
    <Surface tone="default" padding="none" className={cn("h-full overflow-hidden", className)} {...props}>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="group h-full w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-2"
          aria-label={`查看 ${displayName}`}
        >
          <RelicCardInner
            id={id}
            displayName={displayName}
            resolvedType={resolvedType}
            description={description}
            coverUrl={coverUrl}
            avatarUrl={avatarUrl}
          />
        </button>
      ) : (
        <div className="group h-full w-full text-left">
          <RelicCardInner
            id={id}
            displayName={displayName}
            resolvedType={resolvedType}
            description={description}
            coverUrl={coverUrl}
            avatarUrl={avatarUrl}
          />
        </div>
      )}
    </Surface>
  );
}

const RelicCard = memo(RelicCardBase);
RelicCard.displayName = "RelicCard";

export { RelicCard };
export default RelicCard;
