import { Database, FileUp, FileText, Trash2 } from "lucide-react";

import type { KnowledgeSourceGroup } from "../../lib/ui-state";
import { StatusBadge } from "../ui/StatusBadge";

type SourceGroupsProps = {
  groups: KnowledgeSourceGroup[];
  status: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  onDeleteSource?: (sourceId: string) => void;
  onOpenUpload?: () => void;
};

export function SourceGroups({ groups, status, deletingSourceId, onDeleteSource, onOpenUpload }: SourceGroupsProps) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.id}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              <Database className="h-3.5 w-3.5 text-cyan-200" />
              {group.title}
            </h3>
            <StatusBadge tone="slate">{group.sources.length}</StatusBadge>
          </div>
          {group.id === "your-uploads" && onOpenUpload ? (
            <button
              type="button"
              onClick={onOpenUpload}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm font-medium text-cyan-50 transition hover:border-cyan-200/40 hover:bg-cyan-300/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              <FileUp className="h-4 w-4" />
              Upload document
            </button>
          ) : null}
          {status === "loading" && group.id === "your-uploads" ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-500">Loading sources...</p>
          ) : status === "unavailable" && group.id === "your-uploads" ? (
            <p className="rounded-2xl border border-amber-300/15 bg-amber-300/8 px-3 py-2 text-sm leading-6 text-amber-100/80">Source list unavailable. Chat remains available for indexed documents.</p>
          ) : group.sources.length ? (
            <ul className="space-y-2">
              {group.sources.map((source) => (
                <li key={source.id} className="group rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2 transition hover:border-cyan-300/20 hover:bg-cyan-300/8">
                  <div className="flex min-w-0 items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-100">{source.filename}</p>
                      <p className="mt-1 text-xs capitalize text-slate-500">{source.status}</p>
                    </div>
                    {source.sourceType === "uploaded" && onDeleteSource ? (
                      <button
                        type="button"
                        onClick={() => onDeleteSource(source.id)}
                        disabled={deletingSourceId === source.id}
                        className="rounded-xl border border-red-300/15 bg-red-400/10 p-1.5 text-red-200 opacity-0 transition hover:border-red-200/40 hover:bg-red-400/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60 group-hover:opacity-100 focus:opacity-100"
                        aria-label={`Delete ${source.filename}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-slate-500">{group.emptyMessage}</p>
          )}
        </section>
      ))}
    </div>
  );
}
