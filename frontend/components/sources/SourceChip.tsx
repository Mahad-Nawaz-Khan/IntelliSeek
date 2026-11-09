"use client";

import { FileText } from "lucide-react";

import type { SourceCitation } from "../../lib/chat-api";
import { usePreferences } from "../../lib/preferences";
import type { GroupedSourceCitation } from "../../lib/source-citations";
import type { Citation } from "../../lib/ui-state";
import { useWorkspaceOptional } from "../workspace/WorkspaceShell";

type SourceChipProps = {
  citation?: Citation;
  source?: SourceCitation;
  group?: GroupedSourceCitation;
};

function formatGroup(group: GroupedSourceCitation): Citation {
  const chunkCount = group.sources.length;
  const label = chunkCount === 1 ? group.filename : `${group.filename} (${group.chunkRanges})`;
  return {
    id: `${group.documentId}-${group.sources.map((source) => source.chunk_id).join("-")}`,
    sourceId: group.documentId,
    label,
    filename: group.filename,
    locator: group.chunkRanges,
  };
}

function formatSource(source: SourceCitation): Citation {
  return {
    id: `${source.document_id}-${source.chunk_id}-${source.chunk_index}`,
    sourceId: source.document_id,
    label: source.filename,
    filename: source.filename,
    locator: `Chunk ${source.chunk_index + 1}`,
  };
}

function resolveDisplayCitation(
  citation?: Citation,
  group?: GroupedSourceCitation,
  source?: SourceCitation,
): Citation | undefined {
  if (citation) return citation;
  if (group) return formatGroup(group);
  if (source) return formatSource(source);
  return undefined;
}

export function SourceChip({ citation, source, group }: Readonly<SourceChipProps>) {
  const { preferences } = usePreferences();
  const workspace = useWorkspaceOptional();
  const display = resolveDisplayCitation(citation, group, source);
  if (!display) return null;

  const canFocus = Boolean(workspace && display.sourceId && display.filename);

  const chipContent = (
    <>
      <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
      <span className="truncate">{display.label}</span>
      {preferences.citationPreviews && (display.preview || display.locator) && (
        <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-2xl border border-white/10 bg-slate-950/95 p-3 text-left text-xs leading-5 text-slate-300 shadow-2xl shadow-slate-950/50 backdrop-blur-xl group-hover:block group-focus-within:block">
          <span className="block font-semibold text-cyan-100">{display.filename}</span>
          {display.locator && <span className="mt-1 block text-slate-400">{display.locator}</span>}
          {display.preview && <span className="mt-2 block line-clamp-3">{display.preview}</span>}
          {canFocus && (
            <span className="mt-1.5 block border-t border-white/10 pt-1.5 text-[0.65rem] text-cyan-300/80">
              Click to scope follow-up questions to this file
            </span>
          )}
        </span>
      )}
    </>
  );

  if (canFocus) {
    return (
      <button
        type="button"
        onClick={() => workspace?.focusDocumentInChat({ id: display.sourceId, filename: display.filename })}
        className="group relative inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 shadow-sm shadow-cyan-950/20 transition hover:border-cyan-200/50 hover:bg-cyan-300/18 active:scale-95 focus-within:border-cyan-200/50"
        title={`Focus chat on ${display.filename}`}
      >
        {chipContent}
      </button>
    );
  }

  return (
    <span className="group relative inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 shadow-sm shadow-cyan-950/20 transition hover:border-cyan-200/50 hover:bg-cyan-300/15 focus-within:border-cyan-200/50">
      {chipContent}
    </span>
  );
}
