import { memo, type ElementType, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const sectionVariants = cva("", {
  variants: {
    spacing: {
      none: "",
      sm: "py-10 sm:py-14 lg:py-18",
      md: "py-14 sm:py-20 lg:py-26",
      lg: "py-20 sm:py-28 lg:py-36",
    },
  },
  defaultVariants: {
    spacing: "md",
  },
});

export interface SectionProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  readonly as?: ElementType;
}

function SectionBase({
  as: Component = "section",
  className,
  spacing,
  ...props
}: SectionProps) {
  return (
    <Component
      className={cn(sectionVariants({ spacing }), className)}
      {...props}
    />
  );
}

const Section = memo(SectionBase);
Section.displayName = "Section";

export { Section, sectionVariants };
export default Section;
