import { memo, type HTMLAttributes, type ReactNode } from "react";

import Section from "@/components/site/SectionBlock";
import Heading from "@/components/site/SectionHeading";
import Surface from "@/components/site/Surface";

export interface PageIntroProps extends HTMLAttributes<HTMLElement> {
  readonly label: string;
  readonly title: string;
  readonly description: ReactNode;
}

function PageIntroBase({
  className,
  label,
  title,
  description,
  children,
  ...props
}: PageIntroProps) {
  return (
    <Section spacing="sm" className={className} {...props}>
      <Surface tone="warm" padding="lg">
        <Heading
          label={label}
          title={title}
          description={description}
          titleAs="h1"
          align="start"
          width="wide"
        />
        {children ? <div className="mt-6">{children}</div> : null}
      </Surface>
    </Section>
  );
}

const PageIntro = memo(PageIntroBase);
PageIntro.displayName = "PageIntro";

export { PageIntro };
export default PageIntro;
