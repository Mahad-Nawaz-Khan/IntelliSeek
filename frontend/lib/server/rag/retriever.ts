import type { SourceCitation } from "../../chat-api";
import { embedText } from "./embeddings";
import { matchUserChunks, type RetrievedChunk } from "./vector-store";

const DEFAULT_TOP_K = 5;
const MAX_QUESTION_LENGTH = 1000;
export const FILE_CONTEXT_MIN_SCORE = 0.72;
export const FILE_CONTEXT_WEAK_SCORE = 0.62;

export type RetrievedContext = RetrievedChunk;

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
  const queryEmbedding = await embedText(question);
  return matchUserChunks(userId, queryEmbedding, limit);
}

export function filterRelevantContext(context: RetrievedContext[]): RetrievedContext[] {
  const strongMatches = context.filter((chunk) => chunk.score >= FILE_CONTEXT_MIN_SCORE);
  if (strongMatches.length) return strongMatches;

  const topScore = context[0]?.score ?? 0;
  if (topScore >= FILE_CONTEXT_WEAK_SCORE) return context.slice(0, 3);

  return [];
}

export function toSourceCitations(context: RetrievedContext[]): SourceCitation[] {
  return context.map((chunk) => ({
    document_id: chunk.document_id,
    filename: chunk.filename,
    chunk_id: chunk.chunk_id,
    chunk_index: chunk.chunk_index,
  }));
}
