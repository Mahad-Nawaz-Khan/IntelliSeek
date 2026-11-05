export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 180;
export const MIN_CHUNK_SIZE = 200;
export const MAX_BLOCK_SIZE = 600;

const HEADING_PATTERNS = [
  /^#{1,6}\s+\S/,
  /^\d+(?:\.\d+)*\s+\S/,
  /^(chapter|section|unit|module|topic|part|lecture|lesson|appendix)\s+\d*[:.\-\s]/i,
  /^[A-Z][A-Z\s]{4,60}$/,
  /^(?:definition|theorem|lemma|corollary|proposition|example|exercise|proof)\s*[:.]/i,
];

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z0-9])|(?<=\n)\s*(?=\S)/;

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeChunkText(text: string): string {
  return text.replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function isLikelyHeading(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 120) return false;
  return HEADING_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function rebuildParts(pieces: string[], maxSize: number): string[] {
  const parts: string[] = [];
  let current = "";
  for (const piece of pieces) {
    const next = current ? `${current} ${piece.trim()}` : piece.trim();
    if (next.length > maxSize && current) {
      parts.push(current);
      current = piece.trim();
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function splitOversizedBlock(block: string): string[] {
  if (block.length <= MAX_BLOCK_SIZE) return [block];

  const sentences = block.match(/(?:[^.!?]+[.!?]+)|(?:[^.!?]+$)/g) ?? [block];
  if (sentences.length <= 1) {
    const clauses = block.split(/(?<=[,;])\s+/);
    if (clauses.length > 1) {
      return rebuildParts(clauses, MAX_BLOCK_SIZE);
    }
    const mid = Math.floor(block.length / 2);
    const spaceIdx = block.lastIndexOf(" ", mid + 40);
    if (spaceIdx > 0) {
      return [block.slice(0, spaceIdx).trim(), block.slice(spaceIdx + 1).trim()];
    }
  }

  return rebuildParts(sentences, MAX_BLOCK_SIZE);
}

function splitIntoBlocks(text: string): string[] {
  const blocks: string[] = [];
  let current: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      if (current.length) {
        blocks.push(current.join("\n"));
        current = [];
      }
      continue;
    }

    if (isLikelyHeading(line) && current.length) {
      blocks.push(current.join("\n"));
      current = [line];
      continue;
    }

    current.push(line);
  }

  if (current.length) blocks.push(current.join("\n"));
  return blocks.flatMap(splitOversizedBlock).map(normalizeChunkText).filter(Boolean);
}

function overlapText(chunk: string) {
  if (chunk.length <= CHUNK_OVERLAP) return chunk;
  const tail = chunk.slice(-CHUNK_OVERLAP);
  const boundary = tail.search(/[\n.!?]\s+[^\n.!?]*$/);
  return boundary > 0 ? tail.slice(boundary).trim() : tail.trim();
}

export function chunkText(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const blocks = splitIntoBlocks(normalized);
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const next = current ? `${current}\n\n${block}` : block;
    if (next.length <= CHUNK_SIZE || current.length < MIN_CHUNK_SIZE) {
      current = next;
      continue;
    }

    chunks.push(normalizeChunkText(current));
    const overlap = overlapText(current);
    current = overlap ? `${overlap}\n\n${block}` : block;
  }

  if (current) chunks.push(normalizeChunkText(current));

  return chunks;
}

export function splitIntoSentences(text: string): string[] {
  return text
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
}

export type MicroChunk = {
  text: string;
  parentChunkIndex: number;
};

export function microChunkText(text: string): MicroChunk[] {
  const parentChunks = chunkText(text);
  const microChunks: MicroChunk[] = [];

  parentChunks.forEach((parentChunk, parentIndex) => {
    const sentences = splitIntoSentences(parentChunk);
    if (!sentences.length) {
      if (parentChunk.trim()) {
        microChunks.push({ text: parentChunk.trim(), parentChunkIndex: parentIndex });
      }
      return;
    }

    for (let i = 0; i < sentences.length; i += 2) {
      const window = sentences.slice(i, i + 3).join(" ");
      if (window.length >= 25) {
        microChunks.push({ text: window, parentChunkIndex: parentIndex });
      }
    }
  });

  return microChunks;
}
