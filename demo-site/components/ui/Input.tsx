"use client";

import {
  forwardRef,
  memo,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  readonly label?: string;
  readonly helperText?: string;
  readonly error?: string;
  readonly leftSlot?: ReactNode;
  readonly rightSlot?: ReactNode;
  readonly inputSize?: "sm" | "md" | "lg";
}

const inputSizeClassMap: Record<NonNullable<InputProps["inputSize"]>, string> = {
  sm: "h-11 text-sm",
  md: "h-12 text-[15px]",
  lg: "h-14 text-base",
};

const InputBase = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id,
      leftSlot,
      rightSlot,
      inputSize = "md",
      required,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;
    const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="flex w-full flex-col gap-2.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm font-semibold leading-6 text-foreground"
          >
            {label}
            {required ? <span className="ml-1 text-brand">*</span> : null}
          </label>
        ) : null}
        <div
          className={cn(
            "group flex items-center gap-3 rounded-[16px] border border-border/60 bg-surface px-4 shadow-soft backdrop-blur-xl transition-all duration-300 ease-interaction",
            error
              ? "border-red-400/60 ring-2 ring-red-400/12"
              : "border-border/60 hover:border-brand/20 focus-within:border-brand/40 focus-within:ring-4 focus-within:ring-brand/12",
            inputSizeClassMap[inputSize],
          )}
        >
          {leftSlot ? (
            <span className="text-muted-foreground transition-colors duration-300 group-focus-within:text-brand">
              {leftSlot}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={cn(
              "w-full border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-60",
              className,
            )}
            {...props}
          />
          {rightSlot ? <span className="text-muted-foreground">{rightSlot}</span> : null}
        </div>
        {error ? (
          <p id={errorId} className="text-sm leading-6 text-red-500">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-sm leading-6 text-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

InputBase.displayName = "Input";

const Input = memo(InputBase);
Input.displayName = "memo(Input)";

export { Input };
export default Input;
