import { memo, type HTMLAttributes, type ReactNode } from "react";

import Surface from "@/components/site/Surface";
import { cn } from "@/lib/utils";

export interface InfoStripItem {
  readonly key: string;
  readonly title: ReactNode;
  readonly description: ReactNode;
}

export interface InfoStripProps extends HTMLAttributes<HTMLDivElement> {
  readonly items: readonly InfoStripItem[];
}

function InfoStripBase({ className, items, ...props }: InfoStripProps) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4 md:grid-cols-3",
        className,
      )}
      {...props}
    >
      {items.map((item) => (
        <Surface key={item.key} tone="muted" padding="sm" className="flex flex-col">
          <p className="text-sm font-semibold text-foreground">{item.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-foreground-muted">
            {item.description}
          </p>
        </Surface>
      ))}
    </div>
  );
}

const InfoStrip = memo(InfoStripBase);
InfoStrip.displayName = "InfoStrip";

export { InfoStrip };
export default InfoStrip;
