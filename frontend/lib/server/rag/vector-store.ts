import { getSupabaseServiceClient } from "../supabase";

export type StoredChunkVector = {
  chunk_id: string;
  document_id: string;
  filename: string;
  text_content: string;
  chunk_index: number;
  embedding: number[];
};

type ChunkRow = {
  id: string;
  document_id: string;
  text_content: string;
  chunk_index: number;
  embedding: number[] | null;
  documents?: {
    filename?: string | null;
  } | null;
};

export async function loadStoredChunkVectors(userId: string): Promise<StoredChunkVector[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("chunks")
    .select("id, document_id, text_content, chunk_index, embedding, documents!inner(filename, user_id)")
    .eq("documents.user_id", userId)
    .not("embedding", "is", null)
    .limit(1000);

  if (error) throw new Error("Could not load indexed chunks");

  return ((data ?? []) as ChunkRow[])
    .filter((chunk) => Array.isArray(chunk.embedding))
    .map((chunk) => ({
      chunk_id: chunk.id,
      document_id: chunk.document_id,
      filename: chunk.documents?.filename ?? "Uploaded document",
      text_content: chunk.text_content,
      chunk_index: chunk.chunk_index,
      embedding: chunk.embedding ?? [],
    }));
}
