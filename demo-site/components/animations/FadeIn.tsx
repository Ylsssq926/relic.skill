import { memo, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface FadeInProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delay?: number;
}

/**
 * FadeIn — 纯 CSS 入场动画
 *
 * 替代 framer-motion 的 motion.div，避免 hydration mismatch。
 * 使用 CSS animation + animation-delay 实现相同的视觉效果。
 */
function FadeInBase({ children, className, delay = 0 }: FadeInProps) {
  return (
    <div
      className={cn("animate-fade-in-up", className)}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

const FadeIn = memo(FadeInBase);
FadeIn.displayName = "FadeIn";

export { FadeIn };
export default FadeIn;
