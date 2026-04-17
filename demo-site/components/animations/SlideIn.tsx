"use client";

import { memo, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";

export interface SlideInProps extends HTMLMotionProps<"div"> {
  readonly children: ReactNode;
  readonly delay?: number;
  readonly direction?: "top" | "bottom" | "left" | "right";
}

const offsets = {
  top: { x: 0, y: -20 },
  bottom: { x: 0, y: 20 },
  left: { x: -20, y: 0 },
  right: { x: 20, y: 0 },
} as const;

function SlideInBase({
  children,
  className,
  delay = 0,
  direction = "bottom",
  ...props
}: SlideInProps) {
  const offset = offsets[direction];

  return (
    <motion.div
      initial={{ opacity: 0, x: offset.x, y: offset.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.55,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

const SlideIn = memo(SlideInBase);
SlideIn.displayName = "SlideIn";

export { SlideIn };
export default SlideIn;
