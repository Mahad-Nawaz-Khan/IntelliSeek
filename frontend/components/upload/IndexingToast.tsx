"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, X, AlertCircle } from "lucide-react";

export type UploadIndexingToast = {
  toastId: string;
  documentId?: string;
  filename: string;
  queuedAt: number;
  status: "uploading" | "indexing" | "completed" | "failed";
  errorMessage?: string;
};

type IndexingToastProps = {
  toasts: UploadIndexingToast[];
  onDismiss: (toastId: string) => void;
};

function AnimatedDots() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setCount((c) => (c + 1) % 4), 400);
    return () => window.clearInterval(id);
  }, []);

  return <span className="inline-block w-6 text-left">{"".padEnd(count, ".")}</span>;
}

function ToastCard({ toast, onDismiss }: { toast: UploadIndexingToast; onDismiss: (id: string) => void }) {
  const isWorking = toast.status === "uploading" || toast.status === "indexing";
  const isComplete = toast.status === "completed";
  const isFailed = toast.status === "failed";

  const stageLabel =
    toast.status === "uploading"
      ? "Uploading"
      : toast.status === "indexing"
        ? "Indexing"
        : toast.status === "completed"
          ? "Ready"
          : "Failed";

  return (
    <div
      className={[
        "relative overflow-hidden rounded-2xl border backdrop-blur-xl shadow-2xl shadow-slate-950/40 transition-all duration-300",
        isComplete
          ? "border-emerald-400/40 bg-emerald-400/10 indexing-toast-complete"
          : isFailed
            ? "border-red-400/30 bg-red-400/10"
            : "border-cyan-300/20 bg-slate-950/80",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="mt-0.5">
          {isWorking && <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />}
          {isComplete && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          {isFailed && <AlertCircle className="h-4 w-4 text-red-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-100">
            {stageLabel} {toast.filename}
            {isWorking && <AnimatedDots />}
          </p>
          {isFailed && toast.errorMessage && (
            <p className="mt-1 text-xs text-red-200/80">{toast.errorMessage}</p>
          )}
        </div>
        {(isFailed) && (
          <button
            type="button"
            onClick={() => onDismiss(toast.toastId)}
            className="rounded-lg p-1 text-slate-400 transition hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Bottom progress bar */}
      {isWorking && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden bg-slate-800/60">
          <div className="indexing-toast-progress h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" />
        </div>
      )}
      {isComplete && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-emerald-400/70" />
      )}
    </div>
  );
}

export function IndexingToast({ toasts, onDismiss }: IndexingToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-28 right-6 z-50 flex w-[min(22rem,calc(100vw-3rem))] flex-col gap-3">
      {toasts.map((toast) => (
        <ToastCard key={toast.toastId} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
