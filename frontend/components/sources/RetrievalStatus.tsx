import { CheckCircle2, Loader2, Search } from "lucide-react";

import type { RetrievalStatus as RetrievalStatusType } from "../../lib/ui-state";

type RetrievalStatusProps = {
  status: RetrievalStatusType;
};

export function RetrievalStatus({ status }: RetrievalStatusProps) {
  if (status.state === "idle" || status.state === "complete") return null;

  const isWorking = status.state === "analyzing" || status.state === "retrieving" || status.state === "answering";

  return (
    <div className="mb-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/8 p-3 text-sm text-cyan-50">
      <div className="flex items-center gap-2">
        {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        <span>{status.message}</span>
      </div>
      {status.matches?.length ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {status.matches.map((match) => (
            <li key={match.id} className="flex items-start gap-2 rounded-xl bg-slate-950/45 px-3 py-2 text-xs text-slate-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="min-w-0">
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
