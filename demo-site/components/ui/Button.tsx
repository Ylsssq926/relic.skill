"use client";

import { forwardRef, memo, type ButtonHTMLAttributes, type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/buttonStyles";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  readonly loading?: boolean;
  readonly loadingText?: string;
  readonly icon?: ReactNode;
  readonly iconPosition?: "left" | "right";
}

const ButtonBase = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      variant,
      size,
      fullWidth,
      loading = false,
      loadingText,
      disabled,
      icon,
      iconPosition = "left",
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const resolvedLabel = loading ? loadingText ?? children : children;
    const resolvedIcon = loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon;

    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, fullWidth }), className)}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {resolvedIcon && iconPosition === "left" ? resolvedIcon : null}
        <span>{resolvedLabel}</span>
        {resolvedIcon && iconPosition === "right" ? resolvedIcon : null}
      </button>
    );
  },
);

ButtonBase.displayName = "Button";

const Button = memo(ButtonBase);
Button.displayName = "memo(Button)";

export { Button, buttonVariants };
export default Button;
