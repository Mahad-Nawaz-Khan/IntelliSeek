import type { SourceCitation } from "./chat-api";

export type GroupedSourceCitation = {
  documentId: string;
  filename: string;
  sources: SourceCitation[];
  chunkRanges: string;
};

export function isSourceCitation(value: unknown): value is SourceCitation {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return typeof source.document_id === "string"
    && typeof source.filename === "string"
    && typeof source.chunk_id === "string"
    && typeof source.chunk_index === "number";
}

export function normalizeSourceCitations(sources: unknown[], maxSources = 12): SourceCitation[] {
  const seen = new Set<string>();
  const normalized: SourceCitation[] = [];

  for (const source of sources) {
    if (!isSourceCitation(source)) continue;

    const key = `${source.document_id}:${source.chunk_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(source);

    if (normalized.length >= maxSources) break;
  }

  return normalized;
}

function formatChunkRanges(sources: SourceCitation[]) {
  const indexes = [...new Set(sources.map((source) => source.chunk_index + 1))].sort((a, b) => a - b);
  const ranges: string[] = [];

  for (let index = 0; index < indexes.length; index += 1) {
    const start = indexes[index];
    let end = start;
    while (indexes[index + 1] === end + 1) {
      index += 1;
      end = indexes[index];
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
  }

  return ranges.length === 1 ? `Chunk ${ranges[0]}` : `Chunks ${ranges.join(", ")}`;
}

export function groupSourceCitations(sources: SourceCitation[]): GroupedSourceCitation[] {
  const groups = new Map<string, GroupedSourceCitation>();

  normalizeSourceCitations(sources).forEach((source) => {
    const group = groups.get(source.document_id) ?? {
      documentId: source.document_id,
      filename: source.filename,
      sources: [],
      chunkRanges: "",
    };

    group.sources.push(source);
    group.chunkRanges = formatChunkRanges(group.sources);
    groups.set(source.document_id, group);
  });

  return [...groups.values()];
}
