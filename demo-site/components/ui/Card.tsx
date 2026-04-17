import { forwardRef, memo, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import Surface, { type SurfaceProps } from "@/components/site/Surface";
import { cn } from "@/lib/utils";

/**
 * Card — 轻量内容卡片
 *
 * 建立在 Surface 之上，提供 header / body / footer 插槽。
 * 适用于需要标准卡片壳的场景。
 */
const cardBodyVariants = cva("", {
  variants: {
    padding: {
      none: "",
      sm: "px-5 py-4 sm:px-6 sm:py-5",
      md: "px-6 py-6 sm:px-8 sm:py-7",
      lg: "p-7 sm:p-8 lg:p-9",
    },
  },
  defaultVariants: {
    padding: "md",
  },
});

export interface CardProps extends Omit<SurfaceProps, "padding">, VariantProps<typeof cardBodyVariants> {
  readonly header?: ReactNode;
  readonly footer?: ReactNode;
  readonly bodyClassName?: string;
}

const CardBase = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      tone = "default",
      header,
      footer,
      children,
      bodyClassName,
      padding,
      ...props
    },
    ref,
  ) => {
    return (
      <Surface
        ref={ref}
        tone={tone}
        padding="none"
        className={cn("card-hover", className)}
        {...props}
      >
        {header ? (
          <div className="border-b border-border/60 px-6 py-4 sm:px-7">
            {header}
          </div>
        ) : null}
        <div className={cn(cardBodyVariants({ padding }), bodyClassName)}>
          {children}
        </div>
        {footer ? (
          <div className="border-t border-border/60 px-6 py-4 sm:px-7">
            {footer}
          </div>
        ) : null}
      </Surface>
    );
  },
);

CardBase.displayName = "Card";

const Card = memo(CardBase);
Card.displayName = "memo(Card)";

export { Card };
export default Card;
