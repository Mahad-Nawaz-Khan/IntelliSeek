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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// `-` and `_` are filename-internal connectors, not boundaries: an answer that
// cites `lecture-notes.pdf` has not cited `notes.pdf`, and `notes` has not
// cited `notes-v2`.
const NOT_BOUNDARY = "[\\p{L}\\p{N}_-]";

function mentionsFilename(answer: string, filename: string) {
  const trimmed = filename.trim();
  if (!trimmed) return false;
  if (new RegExp(`(?<!${NOT_BOUNDARY})${escapeRegExp(trimmed)}(?![\\p{L}\\p{N}])`, "iu").test(answer)) return true;

  // Models routinely cite `[Chapter 3]` for `Chapter 3.pdf`, so the extension is
  // optional. Short stems are skipped because they collide with ordinary prose.
  const stem = trimmed.replace(/\.[^.]+$/, "").trim();
  if (stem.length < 4 || stem === trimmed) return false;
  return new RegExp(`(?<!${NOT_BOUNDARY})${escapeRegExp(stem)}(?!${NOT_BOUNDARY})`, "iu").test(answer);
}

/**
 * Narrows retrieved sources to the files the answer actually referenced.
 *
 * Retrieval deliberately over-fetches, so listing every retrieved chunk tells
 * the reader that files were used which the answer never drew on. When no
 * filename is referenced the full set is returned unchanged: the answer is
 * still grounded in that context, and hiding every source would be worse than
 * showing a superset.
 */
export function selectCitedSources(answer: string, sources: SourceCitation[]): SourceCitation[] {
  if (!answer.trim() || !sources.length) return sources;

  const citedFilenames = new Set(
    [...new Set(sources.map((source) => source.filename))].filter((filename) => mentionsFilename(answer, filename)),
  );
  if (!citedFilenames.size) return sources;

  return sources.filter((source) => citedFilenames.has(source.filename));
}

function formatChunkRanges(sources: SourceCitation[]) {
  const indexes = [...new Set(sources.map((source) => source.chunk_index + 1))].sort((a, b) => a - b);
  const ranges: string[] = [];

  let index = 0;
  while (index < indexes.length) {
    const start = indexes[index];
    let end = start;
    while (indexes[index + 1] === end + 1) {
      index += 1;
      end = indexes[index];
    }
    ranges.push(start === end ? `${start}` : `${start}-${end}`);
    index += 1;
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
