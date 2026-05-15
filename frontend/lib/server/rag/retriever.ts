import type { SourceCitation } from "../../chat-api";
import { embedText } from "./embeddings";
import { topKBySimilarity } from "./similarity";
import { loadStoredChunkVectors, type StoredChunkVector } from "./vector-store";

const DEFAULT_TOP_K = 3;
const MAX_QUESTION_LENGTH = 1000;

export type RetrievedContext = StoredChunkVector & {
  score: number;
};

export function validateQuestion(question: string): string {
  const trimmed = question.trim();
  if (!trimmed) throw new Error("Question is required");
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    throw new Error(`Question is too long. Maximum is ${MAX_QUESTION_LENGTH} characters.`);
  }
  return trimmed;
}

export async function retrieveContext(
  question: string,
  userId: string,
  limit = DEFAULT_TOP_K,
): Promise<RetrievedContext[]> {
  const candidates = await loadStoredChunkVectors(userId);
  if (!candidates.length) return [];

  const queryEmbedding = await embedText(question);
  return topKBySimilarity(queryEmbedding, candidates, limit);
}

export function toSourceCitations(context: RetrievedContext[]): SourceCitation[] {
  return context.map((chunk) => ({
    document_id: chunk.document_id,
    filename: chunk.filename,
    chunk_id: chunk.chunk_id,
    chunk_index: chunk.chunk_index,
  }));
}
