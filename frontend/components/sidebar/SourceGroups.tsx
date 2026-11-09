"use client";

import { ChevronDown, Database, FileText, FileUp, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";

import type { KnowledgeSource, KnowledgeSourceGroup } from "../../lib/ui-state";
import { SessionTitleLabel } from "./SessionTitleLabel";
import { StatusBadge } from "../ui/StatusBadge";

type SourceGroupsProps = {
  groups: KnowledgeSourceGroup[];
  status: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  focusedSourceId?: string | null;
  onSelectSource?: (source: KnowledgeSource) => void;
  onDeleteSource?: (sourceId: string) => void;
  onOpenUpload?: () => void;
  onOpenKnowledgeBaseUpload?: () => void;
  canManageKnowledgeBase?: boolean;
};

type UploadButtonProps = {
  groupId: string;
  canManageKnowledgeBase?: boolean;
  onOpenKnowledgeBaseUpload?: () => void;
  onOpenUpload?: () => void;
};

function SourceGroupUploadButton({
  groupId,
  canManageKnowledgeBase,
  onOpenKnowledgeBaseUpload,
  onOpenUpload,
}: Readonly<UploadButtonProps>) {
  if (groupId === "knowledge-base" && canManageKnowledgeBase && onOpenKnowledgeBaseUpload) {
    return (
      <button
        type="button"
        onClick={onOpenKnowledgeBaseUpload}
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-2 text-xs font-medium text-cyan-50 transition hover:border-cyan-300/30 hover:bg-cyan-300/16 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <FileUp className="h-3.5 w-3.5" />
        Upload to knowledge base
      </button>
    );
  }

  if (groupId === "your-uploads" && onOpenUpload) {
    return (
      <button
        type="button"
        onClick={onOpenUpload}
        className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/15 bg-cyan-300/10 px-2.5 py-2 text-xs font-medium text-cyan-50 transition hover:border-cyan-300/30 hover:bg-cyan-300/16 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <FileUp className="h-3.5 w-3.5" />
        Upload document
      </button>
    );
  }

  return null;
}

type SourceGroupListProps = {
  group: KnowledgeSourceGroup;
  status: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  focusedSourceId?: string | null;
  onSelectSource?: (source: KnowledgeSource) => void;
  onDeleteSource?: (sourceId: string) => void;
  canManageKnowledgeBase?: boolean;
};

function SourceGroupList({
  group,
  status,
  deletingSourceId,
  focusedSourceId,
  onSelectSource,
  onDeleteSource,
  canManageKnowledgeBase,
}: Readonly<SourceGroupListProps>) {
  if (status === "loading" && group.id === "your-uploads") {
    return <p className="rounded-xl bg-white/5 px-2.5 py-2 text-xs text-slate-500">Loading sources...</p>;
  }

  if (status === "unavailable" && group.id === "your-uploads") {
    return (
      <p className="rounded-xl bg-amber-300/8 px-2.5 py-2 text-xs leading-5 text-amber-100/80">
        Source list unavailable. Chat remains available for indexed documents.
      </p>
    );
  }

  if (!group.sources.length) {
    return <p className="rounded-xl bg-white/5 px-2.5 py-2 text-xs leading-5 text-slate-500">{group.emptyMessage}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {group.sources.map((source) => {
        const canDelete =
          (source.sourceType === "uploaded" || (source.sourceType === "knowledge-base" && canManageKnowledgeBase)) &&
          onDeleteSource;
        const isFocused = focusedSourceId === source.id;
        const canFocus = source.status === "indexed" && Boolean(onSelectSource);

        return (
          <li
            key={source.id}
            className={`group relative rounded-xl transition-all duration-150 ${
              source.status === "indexing" ? "status-ring status-ring-indexing" : ""
            } ${
              isFocused
                ? "bg-cyan-300/14 ring-1 ring-cyan-300/30"
                : "hover:bg-cyan-300/8"
            }`}
          >
            <div className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5">
              {canFocus ? (
                <button
                  type="button"
                  onClick={() => onSelectSource?.(source)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={isFocused ? `Focused on ${source.filename} — click to ask` : `Focus chat on ${source.filename}`}
                >
                  <FileText
                    className={`h-3.5 w-3.5 shrink-0 transition ${
                      isFocused ? "text-cyan-300" : "text-cyan-200/80 group-hover:text-cyan-200"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <SessionTitleLabel
                      title={source.filename}
                      className={isFocused ? "text-xs font-semibold text-cyan-50" : "text-xs font-medium text-slate-200"}
                    />
                  </div>
                  {isFocused && (
                    <Sparkles className="h-3 w-3 shrink-0 text-cyan-300" aria-label="Focused in chat" />
                  )}
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileText
                    className={`h-3.5 w-3.5 shrink-0 ${
                      source.status === "failed" ? "text-red-300" : "text-cyan-200/80"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <SessionTitleLabel
                      title={source.filename}
                      className={source.status === "failed" ? "text-xs font-medium text-red-200" : "text-xs font-medium text-slate-200"}
                    />
                    {source.status === "failed" ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-red-300/90" title={source.summary}>
                        <span className="status-dot status-dot-failed" aria-label="Failed" />
                        <span>Failed</span>
                      </p>
                    ) : source.status === "indexing" ? (
                      <p className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-purple-300/90">
                        <span className="status-dot status-dot-indexing" aria-label="Indexing" />
                        <span>Indexing…</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {canDelete ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteSource(source.id);
                  }}
                  disabled={deletingSourceId === source.id}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-all duration-150 hover:bg-red-500/15 hover:text-red-200 active:scale-90 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`Delete ${source.filename}`}
                  title="Remove source"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SourceGroups({
  groups,
  status,
  deletingSourceId,
  focusedSourceId,
  onSelectSource,
  onDeleteSource,
  onOpenUpload,
  onOpenKnowledgeBaseUpload,
  canManageKnowledgeBase,
}: Readonly<SourceGroupsProps>) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(["your-uploads"]));

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
              className="group/header flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
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
                <ChevronDown
                  className={`absolute h-4 w-4 text-slate-400 opacity-0 transition group-hover/header:opacity-100 group-focus-visible/header:opacity-100 ${
                    isOpen ? "rotate-180 text-cyan-200" : ""
                  }`}
                />
              </span>
            </button>

            {isOpen ? (
              <div className="mt-1.5 pl-2">
                <SourceGroupUploadButton
                  groupId={group.id}
                  canManageKnowledgeBase={canManageKnowledgeBase}
                  onOpenKnowledgeBaseUpload={onOpenKnowledgeBaseUpload}
                  onOpenUpload={onOpenUpload}
                />
                <SourceGroupList
                  group={group}
                  status={status}
                  deletingSourceId={deletingSourceId}
                  focusedSourceId={focusedSourceId}
                  onSelectSource={onSelectSource}
                  onDeleteSource={onDeleteSource}
                  canManageKnowledgeBase={canManageKnowledgeBase}
                />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
