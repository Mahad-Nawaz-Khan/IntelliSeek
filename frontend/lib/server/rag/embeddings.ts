const EMBEDDING_DIMENSION = 384;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function embedText(text: string): number[] {
  const vector = Array.from({ length: EMBEDDING_DIMENSION }, () => 0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const hash = hashToken(token);
    const position = hash % EMBEDDING_DIMENSION;
    const sign = hash & 1 ? 1 : -1;
    vector[position] += sign;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return vector;

  return vector.map((value) => value / magnitude);
}

export function embedTexts(texts: string[]): number[][] {
  return texts.map(embedText);
}
