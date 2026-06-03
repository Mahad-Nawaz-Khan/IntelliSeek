import { FileSearch } from "lucide-react";

import type { RetrievalMatch } from "../../lib/ui-state";

type RetrievalPanelProps = {
  matches: RetrievalMatch[];
};

export function RetrievalPanel({ matches }: RetrievalPanelProps) {
  return (
    <aside className="hidden w-80 shrink-0 border-l border-white/10 bg-slate-950/35 p-4 xl:block">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-100">
        <FileSearch className="h-4 w-4 text-cyan-200" />
        Retrieved Sources
      </div>
      {matches.length ? (
        <div className="space-y-3">
          {matches.map((match) => (
            <article key={match.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="truncate text-sm font-medium text-slate-100">{match.filename}</p>
              {match.locator && <p className="mt-1 text-xs text-cyan-200">{match.locator}</p>}
              {match.snippet && <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{match.snippet}</p>}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-500">Source previews appear here when IntelliSeek finds matching note chunks.</p>
      )}
    </aside>
  );
}
