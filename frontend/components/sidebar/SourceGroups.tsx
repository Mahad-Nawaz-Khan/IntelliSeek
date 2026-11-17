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
  includeKnowledgeBase?: boolean;
  onToggleKnowledgeBase?: () => void;
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
  isExcluded?: boolean;
  onSelectSource?: (source: KnowledgeSource) => void;
  onDeleteSource?: (sourceId: string) => void;
  canManageKnowledgeBase?: boolean;
};

function SourceItemStatus({ status, summary }: Readonly<{ status: KnowledgeSource["status"]; summary?: string }>) {
  if (status === "failed") {
    return (
      <p className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-red-300/90" title={summary}>
        <span className="status-dot status-dot-failed" aria-label="Failed" />
        <span>Failed</span>
      </p>
    );
  }
  if (status === "indexing") {
    return (
      <p className="mt-0.5 flex items-center gap-1.5 text-[0.65rem] text-purple-300/90">
        <span className="status-dot status-dot-indexing" aria-label="Indexing" />
        <span>Indexing…</span>
      </p>
    );
  }
  return null;
}

type SourceGroupItemProps = {
  source: KnowledgeSource;
  isExcluded: boolean;
  focusedSourceId?: string | null;
  deletingSourceId?: string | null;
  canManageKnowledgeBase?: boolean;
  onSelectSource?: (source: KnowledgeSource) => void;
  onDeleteSource?: (sourceId: string) => void;
};

function FocusedSourceButton({
  source,
  isFocused,
  onSelectSource,
}: Readonly<{
  source: KnowledgeSource;
  isFocused: boolean;
  onSelectSource?: (source: KnowledgeSource) => void;
}>) {
  const focusIconClass = isFocused ? "text-cyan-300" : "text-cyan-200/80 group-hover:text-cyan-200";
  const focusTitleClass = isFocused ? "text-xs font-semibold text-cyan-50" : "text-xs font-medium text-slate-200";
  const focusTitle = isFocused
    ? `Focused on ${source.filename} — click to ask`
    : `Focus chat on ${source.filename}`;

  return (
    <button
      type="button"
      onClick={() => onSelectSource?.(source)}
      className="flex min-w-0 flex-1 items-center gap-2 text-left"
      title={focusTitle}
    >
      <FileText className={`h-3.5 w-3.5 shrink-0 transition ${focusIconClass}`} />
      <div className="min-w-0 flex-1">
        <SessionTitleLabel title={source.filename} className={focusTitleClass} />
      </div>
      {isFocused && <Sparkles className="h-3 w-3 shrink-0 text-cyan-300" aria-label="Focused in chat" />}
    </button>
  );
}

function StaticSourceRow({ source }: Readonly<{ source: KnowledgeSource }>) {
  const staticIconClass = source.status === "failed" ? "text-red-300" : "text-cyan-200/80";
  const staticTitleClass =
    source.status === "failed" ? "text-xs font-medium text-red-200" : "text-xs font-medium text-slate-200";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <FileText className={`h-3.5 w-3.5 shrink-0 ${staticIconClass}`} />
      <div className="min-w-0 flex-1">
        <SessionTitleLabel title={source.filename} className={staticTitleClass} />
        <SourceItemStatus status={source.status} summary={source.summary} />
      </div>
    </div>
  );
}

function canDeleteSourceItem(source: KnowledgeSource, canManageKnowledgeBase?: boolean): boolean {
  if (source.sourceType === "uploaded") return true;
  return source.sourceType === "knowledge-base" && Boolean(canManageKnowledgeBase);
}

function SourceGroupItem({
  source,
  isExcluded,
  focusedSourceId,
  deletingSourceId,
  canManageKnowledgeBase,
  onSelectSource,
  onDeleteSource,
}: Readonly<SourceGroupItemProps>) {
  const showDelete = Boolean(onDeleteSource) && canDeleteSourceItem(source, canManageKnowledgeBase);
  const isFocused = !isExcluded && focusedSourceId === source.id;
  const canFocus = !isExcluded && source.status === "indexed" && Boolean(onSelectSource);
  const ringClass = source.status === "indexing" ? "status-ring status-ring-indexing" : "";
  const focusRowClass = isFocused ? "bg-cyan-300/14 ring-1 ring-cyan-300/30" : "hover:bg-cyan-300/8";

  return (
    <li className={`group relative rounded-xl transition-all duration-150 ${ringClass} ${focusRowClass}`}>
      <div className="flex min-w-0 items-center gap-1.5 px-2.5 py-1.5">
        {canFocus ? (
          <FocusedSourceButton source={source} isFocused={isFocused} onSelectSource={onSelectSource} />
        ) : (
          <StaticSourceRow source={source} />
        )}

        {showDelete && onDeleteSource && (
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
        )}
      </div>
    </li>
  );
}

function SourceGroupList({
  group,
  status,
  deletingSourceId,
  focusedSourceId,
  isExcluded = false,
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
    <ul className={`space-y-1.5 transition-opacity duration-200 ${isExcluded ? "opacity-50" : ""}`}>
      {group.sources.map((source) => (
        <SourceGroupItem
          key={source.id}
          source={source}
          isExcluded={isExcluded}
          focusedSourceId={focusedSourceId}
          deletingSourceId={deletingSourceId}
          canManageKnowledgeBase={canManageKnowledgeBase}
          onSelectSource={onSelectSource}
          onDeleteSource={onDeleteSource}
        />
      ))}
    </ul>
  );
}

function toggleGroupIdInSet(current: Set<string>, groupId: string): Set<string> {
  const next = new Set(current);
  if (next.has(groupId)) {
    next.delete(groupId);
  } else {
    next.add(groupId);
  }
  return next;
}

const KB_ACTIVE_LABEL = "Exclude Knowledge Base from chat AI";
const KB_OFF_LABEL = "Include Knowledge Base in chat AI";
const KB_ACTIVE_TITLE = "Knowledge Base active in chat (click to turn off)";
const KB_OFF_TITLE = "Knowledge Base off (click to enable in chat)";

type SourceGroupSectionProps = {
  group: KnowledgeSourceGroup;
  status: SourceGroupsProps["status"];
  isOpen: boolean;
  includeKnowledgeBase: boolean;
  deletingSourceId?: string | null;
  focusedSourceId?: string | null;
  canManageKnowledgeBase?: boolean;
  onToggleGroup: (groupId: string) => void;
  onToggleKnowledgeBase?: () => void;
  onSelectSource?: (source: KnowledgeSource) => void;
  onDeleteSource?: (sourceId: string) => void;
  onOpenUpload?: () => void;
  onOpenKnowledgeBaseUpload?: () => void;
};

function SourceGroupSection({
  group,
  status,
  isOpen,
  includeKnowledgeBase,
  deletingSourceId,
  focusedSourceId,
  canManageKnowledgeBase,
  onToggleGroup,
  onToggleKnowledgeBase,
  onSelectSource,
  onDeleteSource,
  onOpenUpload,
  onOpenKnowledgeBaseUpload,
}: Readonly<SourceGroupSectionProps>) {
  const isKnowledgeBaseGroup = group.id === "knowledge-base";
  const isExcluded = isKnowledgeBaseGroup && !includeKnowledgeBase;
  const headerTone = isExcluded ? "text-slate-500" : "text-slate-400";
  const iconTone = isExcluded ? "text-slate-500" : "text-cyan-200";
  const trackTone = includeKnowledgeBase ? "border-cyan-300/50 bg-cyan-400" : "border-white/15 bg-slate-800/80";
  const thumbTone = includeKnowledgeBase ? "translate-x-4.5 bg-slate-950" : "translate-x-0.5 bg-slate-300";

  return (
    <section>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onToggleGroup(group.id)}
          className="group/header flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          aria-expanded={isOpen}
        >
          <span className={`flex min-w-0 flex-1 items-center gap-2 overflow-hidden font-semibold uppercase ${headerTone}`}>
            <Database className={`h-3.5 w-3.5 shrink-0 ${iconTone}`} />
            <span className="block min-w-0 truncate whitespace-nowrap text-[clamp(0.48rem,0.72vw,0.68rem)] leading-4 tracking-[clamp(0.02em,0.18vw,0.16em)]">
              {group.title}
            </span>
          </span>
          <span className="relative flex h-5 min-w-6 shrink-0 items-center justify-center">
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

        {isKnowledgeBaseGroup && onToggleKnowledgeBase && (
          <button
            type="button"
            role="switch"
            aria-checked={includeKnowledgeBase}
            aria-label={includeKnowledgeBase ? KB_ACTIVE_LABEL : KB_OFF_LABEL}
            title={includeKnowledgeBase ? KB_ACTIVE_TITLE : KB_OFF_TITLE}
            onClick={onToggleKnowledgeBase}
            className={`relative mr-1 inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${trackTone}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full transition-transform duration-200 ${thumbTone}`} />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="mt-1.5 pl-2">
          {isExcluded && (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-300/20 bg-amber-400/8 px-2.5 py-1.5 text-[0.68rem] text-amber-100/90">
              <span>Off for chat AI</span>
              {onToggleKnowledgeBase && (
                <button
                  type="button"
                  onClick={onToggleKnowledgeBase}
                  className="font-semibold text-amber-200 underline decoration-amber-300/50 underline-offset-2 transition hover:text-white"
                >
                  Enable
                </button>
              )}
            </div>
          )}
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
            isExcluded={isExcluded}
            onSelectSource={onSelectSource}
            onDeleteSource={onDeleteSource}
            canManageKnowledgeBase={canManageKnowledgeBase}
          />
        </div>
      )}
    </section>
  );
}

export function SourceGroups({
  groups,
  status,
  deletingSourceId,
  focusedSourceId,
  includeKnowledgeBase = true,
  onToggleKnowledgeBase,
  onSelectSource,
  onDeleteSource,
  onOpenUpload,
  onOpenKnowledgeBaseUpload,
  canManageKnowledgeBase,
}: Readonly<SourceGroupsProps>) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(["your-uploads"]));

  function toggleGroup(groupId: string) {
    setOpenGroups((current) => toggleGroupIdInSet(current, groupId));
  }

  return (
    <div className="space-y-1.5">
      {groups.map((group) => (
        <SourceGroupSection
          key={group.id}
          group={group}
          status={status}
          isOpen={openGroups.has(group.id)}
          includeKnowledgeBase={includeKnowledgeBase}
          deletingSourceId={deletingSourceId}
          focusedSourceId={focusedSourceId}
          canManageKnowledgeBase={canManageKnowledgeBase}
          onToggleGroup={toggleGroup}
          onToggleKnowledgeBase={onToggleKnowledgeBase}
          onSelectSource={onSelectSource}
          onDeleteSource={onDeleteSource}
          onOpenUpload={onOpenUpload}
          onOpenKnowledgeBaseUpload={onOpenKnowledgeBaseUpload}
        />
      ))}
    </div>
  );
}
