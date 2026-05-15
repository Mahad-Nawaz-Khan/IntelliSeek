export type RankedVector<T> = T & {
  score: number;
};

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (!magnitudeA || !magnitudeB) return 0;
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

export function topKBySimilarity<T extends { embedding: number[] }>(
  queryEmbedding: number[],
  candidates: T[],
  limit: number,
): RankedVector<T>[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: cosineSimilarity(queryEmbedding, candidate.embedding),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
