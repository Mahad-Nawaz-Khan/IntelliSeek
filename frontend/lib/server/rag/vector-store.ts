import { getSupabaseServiceClient } from "../supabase";

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
): Promise<RetrievedChunk[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc("match_user_chunks", {
    query_embedding: toVectorLiteral(queryEmbedding),
    match_user_id: userId,
    match_count: limit,
  });

  if (error) throw new Error("Could not search indexed chunks");

  return ((data ?? []) as MatchUserChunkRow[]).map((chunk) => ({
    chunk_id: chunk.chunk_id,
    document_id: chunk.document_id,
    filename: chunk.filename ?? "Uploaded document",
    text_content: chunk.text_content,
    chunk_index: chunk.chunk_index,
    score: chunk.similarity ?? 0,
  }));
}
