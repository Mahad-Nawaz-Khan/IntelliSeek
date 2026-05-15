import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import type { UploadItem } from "../../lib/ui-state";

type UploadProgressProps = {
  item: UploadItem;
  onRetry?: () => void;
};

export function UploadProgress({ item, onRetry }: UploadProgressProps) {
  const isFailed = item.status === "failed";
  const isComplete = item.status === "indexed";
  const progress = item.progress ?? (isComplete ? 100 : item.status === "indexing" ? 80 : 45);

  return (
    <div className={`rounded-2xl border p-4 ${isFailed ? "border-red-300/20 bg-red-400/10" : isComplete ? "border-emerald-300/20 bg-emerald-400/10" : "border-cyan-300/20 bg-cyan-300/10"}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-100">
          {isFailed ? <AlertCircle className="h-5 w-5 text-red-200" /> : isComplete ? <CheckCircle2 className="h-5 w-5 text-emerald-200" /> : <Loader2 className="h-5 w-5 animate-spin text-cyan-200" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold text-white">{item.filename}</p>
            <span className="shrink-0 text-xs uppercase tracking-[0.18em] text-slate-400">{item.status}</span>
          </div>
          {item.sizeLabel && <p className="mt-1 text-xs text-slate-500">{item.sizeLabel}</p>}
          {!isFailed && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/60">
              <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {isFailed && item.errorMessage && <p className="mt-2 text-sm text-red-100">{item.errorMessage}</p>}
          {isComplete && <p className="mt-2 text-sm text-emerald-100">Indexed and ready to chat with.</p>}
          {isFailed && onRetry && (
            <button type="button" onClick={onRetry} className="mt-3 rounded-xl border border-red-200/20 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-200/10">
              Retry upload
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
