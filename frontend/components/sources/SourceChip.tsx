import { FileText } from "lucide-react";

import type { SourceCitation } from "../../lib/chat-api";
import type { GroupedSourceCitation } from "../../lib/source-citations";
import type { Citation } from "../../lib/ui-state";

type SourceChipProps = {
  citation?: Citation;
  source?: SourceCitation;
  group?: GroupedSourceCitation;
};

function toChunkLabel(sources: SourceCitation[]) {
  const chunkIndexes = [...new Set(sources.map((source) => source.chunk_index))]
    .sort((a, b) => a - b)
    .map((chunkIndex) => chunkIndex + 1);

  return chunkIndexes.length === 1
    ? `Chunk ${chunkIndexes[0]}`
    : `Chunks ${chunkIndexes.join(", ")}`;
}

function formatGroup(group: GroupedSourceCitation): Citation {
  const chunkCount = group.sources.length;
  return {
    id: `${group.documentId}-${group.sources.map((source) => source.chunk_id).join("-")}`,
    sourceId: group.documentId,
    label: chunkCount === 1 ? group.filename : `${group.filename} · ${chunkCount} chunks`,
    filename: group.filename,
    locator: toChunkLabel(group.sources),
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

export function SourceChip({ citation, source, group }: SourceChipProps) {
  const display = citation ?? (group ? formatGroup(group) : source ? formatSource(source) : undefined);
  if (!display) return null;

  return (
    <span className="group relative inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 shadow-sm shadow-cyan-950/20 transition hover:border-cyan-200/50 hover:bg-cyan-300/15 focus-within:border-cyan-200/50">
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{display.label}</span>
      {(display.preview || display.locator) && (
        <span className="pointer-events-none absolute bottom-full left-0 z-30 mb-2 hidden w-64 rounded-2xl border border-white/10 bg-slate-950/95 p-3 text-left text-xs leading-5 text-slate-300 shadow-2xl shadow-slate-950/50 backdrop-blur-xl group-hover:block group-focus-within:block">
          <span className="block font-semibold text-cyan-100">{display.filename}</span>
          {display.locator && <span className="mt-1 block text-slate-500">{display.locator}</span>}
          {display.preview && <span className="mt-2 block line-clamp-3">{display.preview}</span>}
        </span>
      )}
    </span>
  );
}
