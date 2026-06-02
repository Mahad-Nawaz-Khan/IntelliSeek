import { getSupabaseServiceClient } from "../supabase";
import type { RequestLogger } from "../logger";

export type RetrievedChunk = {
  chunk_id: string;
  document_id: string;
  filename: string;
  text_content: string;
  chunk_index: number;
  score: number;
};

type MatchUserChunkRow = {
  chunk_id: string;
  document_id: string;
  filename: string | null;
  text_content: string;
  chunk_index: number;
  similarity: number | null;
};

function toVectorLiteral(embedding: number[]) {
  return `[${embedding.join(",")}]`;
}

export async function matchUserChunks(
  userId: string,
  queryEmbedding: number[],
  limit: number,
  log?: RequestLogger,
): Promise<RetrievedChunk[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    log?.error("vector.rpc.client_unavailable", { errorCategory: "supabase_query", userId });
    return [];
  }

  const startedAt = Date.now();
  log?.info("vector.rpc.start", {
    userId,
    limit,
    embeddingDimension: queryEmbedding.length,
  });

  const { data, error } = await supabase.rpc("match_user_chunks", {
    query_embedding: toVectorLiteral(queryEmbedding),
    match_user_id: userId,
    match_count: limit,
  });

  if (error) {
    log?.error("vector.rpc.failed", {
      errorCategory: "supabase_query",
      userId,
      limit,
      embeddingDimension: queryEmbedding.length,
      durationMs: Date.now() - startedAt,
      error,
    });
    throw new Error("Could not search indexed chunks");
  }

  const chunks = ((data ?? []) as MatchUserChunkRow[]).map((chunk) => ({
    chunk_id: chunk.chunk_id,
    document_id: chunk.document_id,
    filename: chunk.filename ?? "Uploaded document",
    text_content: chunk.text_content,
    chunk_index: chunk.chunk_index,
    score: chunk.similarity ?? 0,
  }));

  log?.info("vector.rpc.complete", {
    userId,
    limit,
    resultCount: chunks.length,
    durationMs: Date.now() - startedAt,
  });

  return chunks;
}
