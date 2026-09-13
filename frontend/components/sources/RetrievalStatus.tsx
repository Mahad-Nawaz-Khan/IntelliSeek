"use client";

import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";

type RetrievalStatusProps = {
  /** Shown in the floating pill while the current answer is being prepared. */
  message: string;
};

/**
 * The retrieval indicator, portalled above the message list instead of rendered
 * inside it. The in-flow banner used to push every message down on mount and
 * pull them back up on completion, and scrolled away with the conversation.
 */
export function RetrievalStatus({ message }: RetrievalStatusProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={{ animation: "retrievalSlideIn 300ms ease-out both" }}
      className="fixed left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-300/25 bg-slate-950/85 px-4 py-2 text-xs font-medium text-cyan-50 shadow-xl shadow-cyan-950/30 backdrop-blur-md md:top-20"
    >
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-cyan-300" />
      <span>{message}</span>
    </div>,
    document.body,
  );
}
