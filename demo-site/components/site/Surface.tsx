import { forwardRef, memo, type HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Surface — 语义面板原语
 *
 * 简化为 4 种 tone，每种有明确的语义：
 *   default  : 标准卡片（白底、轻阴影）
 *   muted    : 弱化区域（浅灰底、无边框）
 *   elevated : 浮起面板（强阴影、用于 hero/CTA 等重点区）
 *   warm     : 温暖背景（奶白底，用于需要温度的区域）
 */
const surfaceVariants = cva(
  "relative overflow-hidden border border-border/60 bg-surface text-foreground",
  {
    variants: {
      tone: {
        default: "rounded-lg shadow-soft",
        muted: "rounded-lg border-transparent bg-background-soft",
        elevated:
          "rounded-xl shadow-elevated",
        warm: "rounded-xl border-border/40 bg-surface-warm shadow-soft",
      },
      padding: {
        none: "",
        sm: "px-5 py-4 sm:px-6 sm:py-5",
        md: "px-6 py-6 sm:px-8 sm:py-8",
        lg: "px-7 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12",
        hero: "px-7 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16 xl:px-16 xl:py-20",
      },
    },
    defaultVariants: {
      tone: "default",
      padding: "md",
    },
  },
);

export interface SurfaceProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {}

const SurfaceBase = forwardRef<HTMLDivElement, SurfaceProps>(
  ({ className, tone, padding, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(surfaceVariants({ tone, padding }), className)}
        {...props}
      />
    );
  },
);

SurfaceBase.displayName = "Surface";

const Surface = memo(SurfaceBase);
Surface.displayName = "memo(Surface)";

export { Surface, surfaceVariants };
export default Surface;
