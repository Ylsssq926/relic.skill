"use client";

import { memo, useEffect, useMemo, useState } from "react";

export interface TypeWriterProps {
  readonly text: string;
  readonly speed?: number;
  readonly onComplete?: () => void;
}

function TypeWriterContent({ text, speed = 60, onComplete }: TypeWriterProps) {
  const [visibleLength, setVisibleLength] = useState(0);

  useEffect(() => {
    if (!text) {
      onComplete?.();
      return;
    }

    if (visibleLength >= text.length) {
      onComplete?.();
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleLength((previous) => previous + 1);
    }, speed);

    return () => window.clearInterval(timer);
  }, [onComplete, speed, text, visibleLength]);

  const content = useMemo(() => text.slice(0, visibleLength), [text, visibleLength]);

  return (
    <span>
      {content}
      {visibleLength < text.length && <span className="typewriter-cursor" aria-hidden="true" />}
    </span>
  );
}

function TypeWriterBase(props: TypeWriterProps) {
  return <TypeWriterContent key={props.text} {...props} />;
}

const TypeWriter = memo(TypeWriterBase);
TypeWriter.displayName = "TypeWriter";

export { TypeWriter };
export default TypeWriter;
