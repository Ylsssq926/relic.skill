import { forwardRef, memo, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type ContainerProps = HTMLAttributes<HTMLDivElement>;

const ContainerBase = forwardRef<HTMLDivElement, ContainerProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("mx-auto w-full max-w-[1200px] px-5 sm:px-7 lg:px-9", className)}
        {...props}
      />
    );
  },
);

ContainerBase.displayName = "Container";

const Container = memo(ContainerBase);
Container.displayName = "Container";

export { Container };
export default Container;
