"use client";

import { useRef, useState, type CSSProperties } from "react";

/**
 * Chat/sidebar item title. Truncated by default; when it overflows, hovering
 * slides it to its end so the whole name can be read (see the
 * chat-title-slide keyframes). The slide distance is measured on hover and
 * handed to the keyframes through a CSS variable; short titles never animate.
 */
export function SessionTitleLabel({
  title,
  className = "text-xs font-medium text-slate-300",
}: Readonly<{
  title: string;
  className?: string;
}>) {
  const innerRef = useRef<HTMLSpanElement>(null);
  const [slideDistance, setSlideDistance] = useState<number | null>(null);

  const measure = () => {
    const el = innerRef.current;
    if (!el) return;
    setSlideDistance(el.scrollWidth > el.clientWidth ? el.clientWidth - el.scrollWidth : null);
  };
  const reset = () => setSlideDistance(null);

  const sliding = slideDistance !== null;
  return (
    <span
      className="block overflow-hidden"
      title={title}
      onMouseEnter={measure}
      onMouseLeave={reset}
    >
      <span
        ref={innerRef}
        className={`block whitespace-nowrap ${className} ${sliding ? "chat-title-sliding" : "truncate"}`}
        style={sliding ? ({ "--chat-title-slide": `${slideDistance}px` } as CSSProperties) : undefined}
      >
        {title}
      </span>
    </span>
  );
}
