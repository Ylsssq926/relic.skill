"use client";

import {
  forwardRef,
  memo,
  useId,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label?: string;
  readonly helperText?: string;
  readonly error?: string;
  readonly leftSlot?: ReactNode;
  readonly footerSlot?: ReactNode;
  readonly resize?: boolean;
}

const TextareaBase = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id,
      leftSlot,
      footerSlot,
      resize = false,
      required,
      rows = 4,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    const helperId = helperText ? `${textareaId}-helper` : undefined;
    const errorId = error ? `${textareaId}-error` : undefined;
    const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <div className="flex w-full flex-col gap-2.5">
        {label ? (
          <label
            htmlFor={textareaId}
            className="text-sm font-semibold leading-6 text-foreground"
          >
            {label}
            {required ? <span className="ml-1 text-brand">*</span> : null}
          </label>
        ) : null}
        <div
          className={cn(
            "group rounded-[16px] border border-border/60 bg-surface px-4 py-3 shadow-soft backdrop-blur-xl transition-all duration-300 ease-interaction",
            error
              ? "border-red-400/60 ring-2 ring-red-400/12"
              : "border-white/14 hover:border-brand/20 focus-within:border-brand/45 focus-within:ring-4 focus-within:ring-brand/12",
          )}
        >
          <div className="flex items-start gap-3">
            {leftSlot ? (
              <span className="mt-1 text-muted-foreground transition-colors duration-300 group-focus-within:text-brand">
                {leftSlot}
              </span>
            ) : null}
            <textarea
              ref={ref}
              id={textareaId}
              required={required}
              rows={rows}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className={cn(
                "min-h-[112px] w-full border-none bg-transparent text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-60",
                resize ? "resize-y" : "resize-none",
                className,
              )}
              {...props}
            />
          </div>
          {footerSlot ? <div className="mt-3 border-t border-white/10 pt-3">{footerSlot}</div> : null}
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

TextareaBase.displayName = "Textarea";

const Textarea = memo(TextareaBase);
Textarea.displayName = "memo(Textarea)";

export { Textarea };
export default Textarea;
