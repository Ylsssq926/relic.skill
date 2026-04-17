import { memo, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const headingVariants = cva("space-y-3", {
  variants: {
    align: {
      start: "text-left",
      center: "mx-auto text-center",
    },
    width: {
      compact: "max-w-2xl",
      normal: "max-w-3xl",
      wide: "max-w-4xl",
    },
  },
  defaultVariants: {
    align: "center",
    width: "normal",
  },
});

export type HeadingAlign = "start" | "center";
export type HeadingWidth = "compact" | "normal" | "wide";

export interface SectionHeadingProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title">,
    VariantProps<typeof headingVariants> {
  readonly label?: ReactNode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly titleAs?: ElementType;
}

function SectionHeadingBase({
  className,
  label,
  title,
  description,
  children,
  align,
  width,
  titleAs: TitleTag = "h2",
  ...props
}: SectionHeadingProps) {
  return (
    <div className={cn(headingVariants({ align, width }), className)} {...props}>
      {label ? (
        <p className="text-small font-semibold uppercase tracking-[0.12em] text-brand/70">
          {label}
        </p>
      ) : null}
      <TitleTag
        className="font-display text-heading-2 text-foreground"
      >
        {title}
      </TitleTag>
      {description ? (
        <p
          className={cn(
            "text-base leading-relaxed text-foreground-muted sm:text-lg",
            align === "center" && "mx-auto",
          )}
        >
          {description}
        </p>
      ) : null}
      {children ? <div className="pt-2">{children}</div> : null}
    </div>
  );
}

const Heading = memo(SectionHeadingBase);
Heading.displayName = "Heading";

export { Heading };
export default Heading;
