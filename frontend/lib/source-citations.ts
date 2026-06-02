import type { SourceCitation } from "./chat-api";

export type GroupedSourceCitation = {
  documentId: string;
  filename: string;
  sources: SourceCitation[];
};

export function isSourceCitation(value: unknown): value is SourceCitation {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return typeof source.document_id === "string"
    && typeof source.filename === "string"
    && typeof source.chunk_id === "string"
    && typeof source.chunk_index === "number";
}

export function normalizeSourceCitations(sources: unknown[], maxSources = 5): SourceCitation[] {
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

export function groupSourceCitations(sources: SourceCitation[]): GroupedSourceCitation[] {
  const groups = new Map<string, GroupedSourceCitation>();

  normalizeSourceCitations(sources).forEach((source) => {
    const group = groups.get(source.document_id) ?? {
      documentId: source.document_id,
      filename: source.filename,
      sources: [],
    };

    group.sources.push(source);
    groups.set(source.document_id, group);
  });

  return [...groups.values()];
}
