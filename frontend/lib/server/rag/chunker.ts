const CHUNK_SIZE = 1400;
const CHUNK_OVERLAP = 300;
const MIN_CHUNK_SIZE = 350;
const MAX_BLOCK_SIZE = 900;

const HEADING_PATTERNS = [
  /^#{1,6}\s+\S/,
  /^\d+(?:\.\d+)*\s+\S/,
  /^(chapter|section|unit|module|topic)\s+\d*[:.\-\s]/i,
];

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

function splitOversizedBlock(block: string): string[] {
  if (block.length <= MAX_BLOCK_SIZE) return [block];

  const sentences = block.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [block];
  const parts: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > MAX_BLOCK_SIZE && current) {
      parts.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  }

  if (current) parts.push(current);
  return parts;
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
