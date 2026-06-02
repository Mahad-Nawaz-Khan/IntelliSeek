import { CheckCircle2, FileText, Loader2, Search } from "lucide-react";

import type { RetrievalStatus as RetrievalStatusType } from "../../lib/ui-state";

type RetrievalStatusProps = {
  status: RetrievalStatusType;
};

const STAGGER_BASE_MS = 180;

export function RetrievalStatus({ status }: RetrievalStatusProps) {
  if (status.state === "idle" || status.state === "complete") return null;

  const isWorking = status.state === "analyzing" || status.state === "retrieving" || status.state === "answering";

  return (
    <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/8 p-4 text-sm text-cyan-50 backdrop-blur-md">
      <div className="flex items-center gap-2.5">
        {isWorking ? (
          <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
        ) : (
          <Search className="h-4 w-4 text-cyan-300" />
        )}
        <span className="font-medium">{status.message}</span>
      </div>
      {status.matches?.length ? (
        <ul className="mt-3 grid gap-2">
          {status.matches.map((match, index) => (
            <li
              key={match.id}
              className="flex items-center gap-2.5 rounded-xl border border-white/5 bg-white/[0.04] px-3 py-2.5 text-xs backdrop-blur-sm"
              style={{
                animationDelay: `${index * STAGGER_BASE_MS}ms`,
                animationFillMode: "both",
                animation: `retrievalSlideIn 400ms ease-out ${index * STAGGER_BASE_MS}ms both`,
              }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 motion-safe:animate-pulse" style={{ animationDelay: `${index * STAGGER_BASE_MS + 200}ms` }} />
              <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-300/70" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-slate-100">{match.filename}</span>
                {match.locator && <span className="text-slate-500">{match.locator}</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
