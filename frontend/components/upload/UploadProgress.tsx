import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import type { UploadItem } from "../../lib/ui-state";

type UploadProgressProps = {
  item: UploadItem;
  onRetry?: () => void;
};

/**
 * Status is communicated visually, not with words: a rotating gradient ring
 * while uploading (blue to cyan) or indexing (purple), a red outline with red
 * text on failure, and a plain neutral card once indexed.
 */
export function UploadProgress({ item, onRetry }: UploadProgressProps) {
  const isFailed = item.status === "failed";
  const isComplete = item.status === "indexed";
  const isIndexing = item.status === "indexing";
  const isInProgress = item.status === "uploading" || isIndexing;
  const progress = item.progress ?? (isComplete ? 100 : isIndexing ? 80 : 45);

  const cardClass = isFailed
    ? "rounded-2xl border border-red-400/60 bg-red-400/5 p-4"
    : isComplete
      ? "rounded-2xl border border-white/10 bg-white/5 p-4"
      : `status-ring rounded-2xl bg-slate-950/95 p-4 ${isIndexing ? "status-ring-indexing" : "status-ring-uploading"}`;

  const body = (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-100">
          {isFailed ? (
            <AlertCircle className="h-5 w-5 text-red-300" />
          ) : isComplete ? (
            <CheckCircle2 className="h-5 w-5 text-slate-300" />
          ) : (
            <Loader2 className={`h-5 w-5 animate-spin ${isIndexing ? "text-purple-300" : "text-cyan-300"}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${isFailed ? "text-red-200" : "text-white"}`}>{item.filename}</p>
          {item.sizeLabel && <p className="mt-1 text-xs text-slate-500">{item.sizeLabel}</p>}
          {!isFailed && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-950/60">
              <div
                className={`h-full rounded-full transition-all ${
                  isIndexing ? "bg-linear-to-r from-purple-500 to-violet-400" : "bg-cyan-300"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {isFailed && item.errorMessage && <p className="mt-2 text-sm text-red-100">{item.errorMessage}</p>}
          {isFailed && onRetry && (
            <button type="button" onClick={onRetry} className="mt-3 rounded-xl border border-red-200/20 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-200/10">
              Retry upload
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className={cardClass}>
      {isInProgress ? <div className="relative">{body}</div> : body}
    </div>
  );
}
