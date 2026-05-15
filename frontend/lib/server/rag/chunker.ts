const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function chunkText(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + CHUNK_SIZE, normalized.length);
    const chunk = normalized.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end === normalized.length) break;
    start = Math.max(0, end - CHUNK_OVERLAP);
  }

  return chunks;
}
