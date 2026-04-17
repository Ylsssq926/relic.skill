"use client";

import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastOptions {
  readonly title: string;
  readonly description?: string;
  readonly variant?: ToastVariant;
  readonly duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "description">> {
  readonly id: number;
  readonly description?: string;
  readonly open: boolean;
}

interface ToastContextValue {
  readonly toast: (options: ToastOptions) => number;
  readonly dismiss: (id: number) => void;
}

const DEFAULT_DURATION = 4200;

const ToastContext = createContext<ToastContextValue | null>(null);

const toastToneMap: Record<
  ToastVariant,
  {
    readonly icon: ReactNode;
    readonly badgeClassName: string;
    readonly ringClassName: string;
  }
> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    badgeClassName: "bg-emerald-500 text-white",
    ringClassName: "ring-emerald-500/16",
  },
  error: {
    icon: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
    badgeClassName: "bg-rose-500 text-white",
    ringClassName: "ring-rose-500/18",
  },
  info: {
    icon: <Info className="h-4 w-4" aria-hidden="true" />,
    badgeClassName: "bg-brand/12 text-brand",
    ringClassName: "ring-brand/16",
  },
  warning: {
    icon: <TriangleAlert className="h-4 w-4" aria-hidden="true" />,
    badgeClassName: "bg-amber-400 text-amber-950",
    ringClassName: "ring-amber-400/18",
  },
};

function ToastViewport({
  items,
  onDismiss,
}: {
  readonly items: readonly ToastItem[];
  readonly onDismiss: (id: number) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-3 px-4 sm:top-5 sm:items-end sm:px-6 lg:px-8">
      {items.map((item) => {
        const tone = toastToneMap[item.variant];

        return (
          <div
            key={item.id}
            role={item.variant === "error" ? "alert" : "status"}
            aria-live={item.variant === "error" ? "assertive" : "polite"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[20px] border border-border/40 bg-surface-elevated p-4 shadow-elevated backdrop-blur-2xl ring-1 transition-all duration-200 ease-interaction",
              tone.ringClassName,
              item.open
                ? "translate-y-0 scale-100 opacity-100"
                : "-translate-y-2 scale-[0.98] opacity-0",
            )}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                tone.badgeClassName,
              )}
            >
              {tone.icon}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold leading-6 text-foreground">{item.title}</p>
              {item.description ? (
                <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-background-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              aria-label="关闭提示"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

const MemoizedToastViewport = memo(ToastViewport);
MemoizedToastViewport.displayName = "memo(ToastViewport)";

function ToastProviderBase({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timerMapRef = useRef<Map<number, number>>(new Map());
  const removeTimerMapRef = useRef<Map<number, number>>(new Map());
  const idRef = useRef(0);

  const clearTimer = useCallback((id: number) => {
    const timer = timerMapRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timerMapRef.current.delete(id);
    }

    const removeTimer = removeTimerMapRef.current.get(id);
    if (removeTimer !== undefined) {
      window.clearTimeout(removeTimer);
      removeTimerMapRef.current.delete(id);
    }
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      setItems((previous) =>
        previous.map((item) =>
          item.id === id
            ? {
                ...item,
                open: false,
              }
            : item,
        ),
      );

      const removeTimer = window.setTimeout(() => {
        setItems((previous) => previous.filter((item) => item.id !== id));
        removeTimerMapRef.current.delete(id);
      }, 200);

      removeTimerMapRef.current.set(id, removeTimer);
    },
    [clearTimer],
  );

  const toast = useCallback(
    ({ title, description, variant = "info", duration = DEFAULT_DURATION }: ToastOptions) => {
      idRef.current += 1;
      const id = idRef.current;

      setItems((previous) => [
        ...previous,
        {
          id,
          title,
          description,
          variant,
          duration,
          open: true,
        },
      ]);

      const timer = window.setTimeout(() => {
        dismiss(id);
      }, duration);

      timerMapRef.current.set(id, timer);
      return id;
    },
    [dismiss],
  );

  useEffect(() => {
    const timerMap = timerMapRef.current;
    const removeTimerMap = removeTimerMapRef.current;

    return () => {
      timerMap.forEach((timer) => window.clearTimeout(timer));
      removeTimerMap.forEach((timer) => window.clearTimeout(timer));
      timerMap.clear();
      removeTimerMap.clear();
    };
  }, []);

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
    }),
    [dismiss, toast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <MemoizedToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const ToastProvider = memo(ToastProviderBase);
ToastProvider.displayName = "memo(ToastProvider)";

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast 必须在 ToastProvider 内部使用。");
  }

  return context;
}

export { ToastProvider };
export default ToastProvider;
