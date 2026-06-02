"use client";

import { ChevronDown, Database, FileText, FileUp, Trash2 } from "lucide-react";
import { useState } from "react";

import type { KnowledgeSourceGroup } from "../../lib/ui-state";
import { StatusBadge } from "../ui/StatusBadge";

type SourceGroupsProps = {
  groups: KnowledgeSourceGroup[];
  status: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  onDeleteSource?: (sourceId: string) => void;
  onOpenUpload?: () => void;
  onOpenKnowledgeBaseUpload?: () => void;
  canManageKnowledgeBase?: boolean;
};

export function SourceGroups({ groups, status, deletingSourceId, onDeleteSource, onOpenUpload, onOpenKnowledgeBaseUpload, canManageKnowledgeBase }: SourceGroupsProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set());

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-1.5">
      {groups.map((group) => {
        const isOpen = openGroups.has(group.id);

        return (
          <section key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="group/header flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              aria-expanded={isOpen}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden font-semibold uppercase text-slate-400">
                <Database className="h-3.5 w-3.5 shrink-0 text-cyan-200" />
                <span className="block min-w-0 whitespace-nowrap text-[clamp(0.48rem,0.72vw,0.68rem)] leading-4 tracking-[clamp(0.02em,0.18vw,0.16em)]">
                  {group.title}
                </span>
              </span>
              <span className="relative flex h-5 min-w-7 items-center justify-center">
                <span className="transition group-hover/header:opacity-0 group-focus-visible/header:opacity-0">
                  <StatusBadge tone="slate">{group.sources.length}</StatusBadge>
                </span>
                <ChevronDown className={`absolute h-4 w-4 text-slate-400 opacity-0 transition group-hover/header:opacity-100 group-focus-visible/header:opacity-100 ${isOpen ? "rotate-180 text-cyan-200" : ""}`} />
              </span>
            </button>

            {isOpen ? (
              <div className="mt-1.5 pl-2">
                {group.id === "knowledge-base" && canManageKnowledgeBase && onOpenKnowledgeBaseUpload ? (
                  <button
                    type="button"
                    onClick={onOpenKnowledgeBaseUpload}
                    className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300/10 px-2.5 py-2 text-xs font-medium text-cyan-50 transition hover:bg-cyan-300/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    Upload to knowledge base
                  </button>
                ) : group.id === "your-uploads" && onOpenUpload ? (
                  <button
                    type="button"
                    onClick={onOpenUpload}
                    className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300/10 px-2.5 py-2 text-xs font-medium text-cyan-50 transition hover:bg-cyan-300/16 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    <FileUp className="h-3.5 w-3.5" />
                    Upload document
                  </button>
                ) : null}
                {status === "loading" && group.id === "your-uploads" ? (
                  <p className="rounded-xl bg-white/[0.04] px-2.5 py-2 text-xs text-slate-500">Loading sources...</p>
                ) : status === "unavailable" && group.id === "your-uploads" ? (
                  <p className="rounded-xl bg-amber-300/8 px-2.5 py-2 text-xs leading-5 text-amber-100/80">Source list unavailable. Chat remains available for indexed documents.</p>
                ) : group.sources.length ? (
                  <ul className="space-y-2">
                    {group.sources.map((source) => (
                      <li key={source.id} className="group rounded-xl px-2.5 py-2 transition hover:bg-cyan-300/8">
                        <div className="flex min-w-0 items-start gap-2">
                          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-100">{source.filename}</p>
                            <p className="mt-1 text-xs capitalize text-slate-500">{source.status}</p>
                          </div>
                          {(source.sourceType === "uploaded" || (source.sourceType === "knowledge-base" && canManageKnowledgeBase)) && onDeleteSource ? (
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
                  <p className="rounded-xl bg-white/[0.04] px-2.5 py-2 text-xs leading-5 text-slate-500">{group.emptyMessage}</p>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
