"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

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
  const containerRef = useRef<HTMLSpanElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [slideDistance, setSlideDistance] = useState<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const el = innerRef.current;
      if (!el) return;
      setSlideDistance(el.scrollWidth > el.clientWidth ? el.clientWidth - el.scrollWidth : null);
    };
    const reset = () => setSlideDistance(null);

    container.addEventListener("mouseenter", measure);
    container.addEventListener("mouseleave", reset);
    container.addEventListener("focusin", measure);
    container.addEventListener("focusout", reset);
    return () => {
      container.removeEventListener("mouseenter", measure);
      container.removeEventListener("mouseleave", reset);
      container.removeEventListener("focusin", measure);
      container.removeEventListener("focusout", reset);
    };
  }, []);

  const sliding = slideDistance !== null;
  return (
    <span
      ref={containerRef}
      className="block overflow-hidden"
      title={title}
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
