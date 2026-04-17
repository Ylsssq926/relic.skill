import Image from "next/image";
import { forwardRef, memo, type HTMLAttributes } from "react";

import { getInitials, cn } from "@/lib/utils";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  readonly name: string;
  readonly src?: string;
  readonly alt?: string;
  readonly size?: "sm" | "md" | "lg";
}

const sizeStyles: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-10 w-10 text-xs",
  md: "h-14 w-14 text-sm",
  lg: "h-[4.5rem] w-[4.5rem] text-lg",
};

const AvatarBase = forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, src, alt, size = "md", className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("relative inline-flex shrink-0", className)}
        {...props}
      >
        <span
          className={cn(
            "relative inline-flex items-center justify-center overflow-hidden rounded-full bg-background-soft text-foreground-muted font-semibold shadow-soft",
            sizeStyles[size],
          )}
        >
          {src ? (
            <Image
              src={src}
              alt={alt ?? `${name} 的头像`}
              fill
              sizes={size === "lg" ? "72px" : size === "md" ? "56px" : "40px"}
              loading="lazy"
              decoding="async"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span>{getInitials(name)}</span>
          )}
        </span>
      </div>
    );
  },
);

AvatarBase.displayName = "Avatar";

const Avatar = memo(AvatarBase);
Avatar.displayName = "Avatar";

export { Avatar };
export default Avatar;
