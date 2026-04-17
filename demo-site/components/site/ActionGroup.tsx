import Link from "next/link";
import { memo, type AnchorHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { type VariantProps } from "class-variance-authority";

import { buttonVariants } from "@/components/ui/buttonStyles";
import { cn } from "@/lib/utils";

const directionClassMap = {
  responsive: "flex-col sm:flex-row sm:flex-wrap sm:items-center",
  row: "flex-row flex-wrap items-center",
  column: "flex-col",
} as const;

const alignClassMap = {
  start: "justify-start",
  center: "justify-center",
  between: "justify-between",
} as const;

const stretchClassMap = {
  mobile: "w-full sm:w-auto",
  always: "w-full",
  none: "w-auto",
} as const;

export interface ActionGroupProps extends HTMLAttributes<HTMLDivElement> {
  readonly direction?: keyof typeof directionClassMap;
  readonly align?: keyof typeof alignClassMap;
}

export interface ActionLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
    VariantProps<typeof buttonVariants> {
  readonly href: string;
  readonly icon?: ReactNode;
  readonly iconPosition?: "left" | "right";
  readonly external?: boolean;
  readonly stretch?: keyof typeof stretchClassMap;
}

function ActionGroupBase({
  className,
  direction = "responsive",
  align = "start",
  ...props
}: ActionGroupProps) {
  return (
    <div
      className={cn(
        "flex gap-3",
        directionClassMap[direction],
        alignClassMap[align],
        className,
      )}
      {...props}
    />
  );
}

function ActionLink({
  className,
  href,
  children,
  icon,
  iconPosition = "right",
  variant = "primary",
  size = "lg",
  fullWidth = false,
  external,
  stretch = "mobile",
  rel,
  target,
  ...props
}: ActionLinkProps) {
  const isExternal = external ?? /^https?:\/\//.test(href);
  const resolvedClassName = cn(
    buttonVariants({ variant, size, fullWidth }),
    stretchClassMap[stretch],
    className,
  );
  const content = (
    <>
      {icon && iconPosition === "left" ? icon : null}
      <span>{children}</span>
      {icon && iconPosition === "right" ? icon : null}
    </>
  );

  if (isExternal) {
    return (
      <a
        href={href}
        target={target ?? "_blank"}
        rel={rel ?? "noreferrer"}
        className={resolvedClassName}
        {...props}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={resolvedClassName} {...props}>
      {content}
    </Link>
  );
}

const ActionGroup = memo(ActionGroupBase);
ActionGroup.displayName = "ActionGroup";

export { ActionGroup, ActionLink };
export default ActionGroup;
