import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-300 ease-interaction focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "rounded-full bg-brand text-white shadow-brand hover:-translate-y-0.5 hover:shadow-elevated active:translate-y-0",
        secondary:
          "rounded-full border border-border-strong bg-surface text-foreground-secondary hover:border-brand/30 hover:text-brand hover:shadow-soft",
        ghost:
          "rounded-full text-foreground-muted hover:bg-background-soft hover:text-foreground",
        warm:
          "rounded-full bg-warm-human/10 text-warm-human hover:bg-warm-human/20",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-12 px-8 text-[15px]",
      },
      fullWidth: {
        true: "w-full",
        false: "w-auto",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
);
