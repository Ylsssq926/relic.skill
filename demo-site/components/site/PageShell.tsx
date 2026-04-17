import { memo, type HTMLAttributes, type ReactNode } from "react";

import Container from "@/components/layout/Container";
import Footer from "@/components/layout/Footer";
import Header from "@/components/layout/Header";
import { cn } from "@/lib/utils";

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly mainClassName?: string;
  readonly containerClassName?: string;
}

function PageShellBase({
  className,
  children,
  mainClassName,
  containerClassName,
  ...props
}: PageShellProps) {
  return (
    <div className={cn("min-h-screen", className)} {...props}>
      <Header />
      <main className={cn("pb-16 pt-6 sm:pt-8 lg:pb-24 lg:pt-10", mainClassName)}>
        <Container className={containerClassName}>
          <div>{children}</div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

const Shell = memo(PageShellBase);
Shell.displayName = "PageShell";

export { Shell as PageShell };
export default Shell;
