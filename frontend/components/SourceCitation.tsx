import { FileText } from "lucide-react";

import type { SourceCitation as SourceCitationType } from "../lib/chat-api";

type SourceCitationProps = {
  source: SourceCitationType;
};

export function SourceCitation({ source }: SourceCitationProps) {
  return (
    <span
      title={`Chunk ${source.chunk_index} • ${source.chunk_id}`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100 shadow-sm shadow-cyan-950/20 transition hover:border-cyan-200/40 hover:bg-cyan-300/15"
    >
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{source.filename}</span>
    </span>
  );
}
