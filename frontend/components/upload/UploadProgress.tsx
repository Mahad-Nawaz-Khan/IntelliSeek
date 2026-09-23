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
function getEstimatedProgress(status: UploadItem["status"], progress?: number): number {
  if (typeof progress === "number") return progress;
  if (status === "indexed") return 100;
  if (status === "indexing") return 80;
  return 45;
}

function getUploadCardClass(status: UploadItem["status"]): string {
  if (status === "failed") {
    return "rounded-2xl border border-red-400/60 bg-red-400/5 p-4";
  }
  if (status === "indexed") {
    return "rounded-2xl border border-white/10 bg-white/5 p-4";
  }
  const ringModifier = status === "indexing" ? "status-ring-indexing" : "status-ring-uploading";
  return `status-ring rounded-2xl bg-slate-950/95 p-4 ${ringModifier}`;
}

function renderUploadStatusIcon(status: UploadItem["status"]) {
  if (status === "failed") {
    return <AlertCircle className="h-5 w-5 text-red-300" />;
  }
  if (status === "indexed") {
    return <CheckCircle2 className="h-5 w-5 text-slate-300" />;
  }
  const colorClass = status === "indexing" ? "text-purple-300" : "text-cyan-300";
  return <Loader2 className={`h-5 w-5 animate-spin ${colorClass}`} />;
}

export function UploadProgress({ item, onRetry }: Readonly<UploadProgressProps>) {
  const isFailed = item.status === "failed";
  const isIndexing = item.status === "indexing";
  const isInProgress = item.status === "uploading" || isIndexing;
  const progress = getEstimatedProgress(item.status, item.progress);
  const cardClass = getUploadCardClass(item.status);

  const body = (
    <div className="p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-slate-100">
          {renderUploadStatusIcon(item.status)}
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
