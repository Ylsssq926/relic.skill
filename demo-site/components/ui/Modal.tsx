"use client";

import {
  forwardRef,
  memo,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  readonly footer?: ReactNode;
  readonly size?: "sm" | "md" | "lg";
  readonly closeOnOverlayClick?: boolean;
  readonly showCloseButton?: boolean;
}

const modalSizeClassMap: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-lg",
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

const ModalBase = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onOpenChange,
      title,
      description,
      footer,
      size = "md",
      closeOnOverlayClick = true,
      showCloseButton = true,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const descriptionId = useId();

    useImperativeHandle(ref, () => panelRef.current as HTMLDivElement);

    useEffect(() => {
      if (!open) {
        return undefined;
      }

      previousFocusRef.current = document.activeElement as HTMLElement | null;
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const focusFrame = window.requestAnimationFrame(() => {
        const focusableElements = panelRef.current?.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR,
        );
        focusableElements?.[0]?.focus();

        if (!focusableElements?.length) {
          panelRef.current?.focus();
        }
      });

      const handleKeyDown = (event: KeyboardEvent) => {
        if (!panelRef.current) {
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onOpenChange(false);
          return;
        }

        if (event.key !== "Tab") {
          return;
        }

        const focusableElements = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
        ).filter((element) => !element.hasAttribute("hidden"));

        if (!focusableElements.length) {
          event.preventDefault();
          panelRef.current.focus();
          return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }

        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      };

      document.addEventListener("keydown", handleKeyDown);

      return () => {
        window.cancelAnimationFrame(focusFrame);
        document.body.style.overflow = previousOverflow;
        document.removeEventListener("keydown", handleKeyDown);
        previousFocusRef.current?.focus();
      };
    }, [onOpenChange, open]);

    if (!open || typeof window === "undefined") {
      return null;
    }

    return createPortal(
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
        <button
          type="button"
          aria-label="关闭弹窗"
          className="absolute inset-0 animate-[modal-fade_200ms_ease-out] bg-foreground/45 backdrop-blur-md"
          onClick={() => {
            if (closeOnOverlayClick) {
              onOpenChange(false);
            }
          }}
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
          className={cn(
            "relative z-10 flex max-h-[calc(100vh-2rem)] w-full animate-[modal-pop_220ms_cubic-bezier(0.16,1,0.3,1)] flex-col overflow-hidden rounded-[24px] border border-border/40 bg-surface-elevated shadow-elevated backdrop-blur-2xl",
            modalSizeClassMap[size],
            className,
          )}
          {...props}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/30 px-6 py-5 sm:px-8">
            <div className="space-y-2">
              <h2 id={titleId} className="text-2xl font-bold leading-tight text-foreground">
                {title}
              </h2>
              {description ? (
                <p
                  id={descriptionId}
                  className="max-w-2xl text-sm leading-7 text-muted-foreground"
                >
                  {description}
                </p>
              ) : null}
            </div>
            {showCloseButton ? (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/14 bg-white/70 text-muted-foreground transition-colors duration-200 hover:border-brand/20 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <div className="custom-scrollbar overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
          {footer ? (
            <div className="border-t border-white/10 px-6 py-5 sm:px-8">{footer}</div>
          ) : null}
        </div>
      </div>,
      document.body,
    );
  },
);

ModalBase.displayName = "Modal";

const Modal = memo(ModalBase);
Modal.displayName = "memo(Modal)";

export { Modal };
export default Modal;
