import { BUCKET_NAME } from "../../../upload-config";
import { chunkText } from "../../rag/chunker";
import { EMBEDDING_DIMENSION, embedTexts } from "../../rag/embeddings";
import { extractTextFromBuffer } from "../../rag/parser";
import { extractTopicsFromChunks } from "../../rag/topics";
import { getSupabaseServiceClient } from "../../supabase";
import { inngest } from "../client";

function toVectorLiteral(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, received ${embedding.length}.`);
  }
  return `[${embedding.join(",")}]`;
}

function safeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Document indexing failed";
}

async function markDocumentFailed(documentId: string, error: unknown) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  await supabase
    .from("documents")
    .update({
      processing_status: "failed",
      processing_error: safeErrorMessage(error),
    })
    .eq("id", documentId);
}

export const indexDocument = inngest.createFunction(
  { id: "index-document", triggers: [{ event: "document/index.requested" }] },
  async ({ event, step }) => {
    const { userId, documentId, storagePath, filename, fileType } = event.data;
    const supabase = getSupabaseServiceClient();
    if (!supabase) throw new Error("Supabase service client is not configured");

    try {
      const document = await step.run("Load document", async () => {
        const { data, error } = await supabase
          .from("documents")
          .select("id, user_id, processing_status")
          .eq("id", documentId)
          .eq("user_id", userId)
          .single();

        if (error || !data) throw new Error("Document not found");
        return data as { id: string; user_id: string; processing_status: string };
      });

      if (document.processing_status === "indexed") {
        return { documentId, status: "indexed" };
      }

      await step.run("Mark processing", async () => {
        const { error } = await supabase
          .from("documents")
          .update({ processing_status: "processing", processing_error: null })
          .eq("id", documentId)
          .eq("user_id", userId);
        if (error) throw new Error("Could not mark document as processing");
      });

      const extracted = await step.run("Parse document", async () => {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storagePath);
        if (error || !data) throw new Error(error?.message ?? "Stored file not found");
        return extractTextFromBuffer(await data.arrayBuffer(), filename, fileType);
      });

      const chunks = await step.run("Chunk document", async () => {
        const parsedChunks = chunkText(extracted);
        if (!parsedChunks.length) throw new Error("Extracted text has no indexable content");
        return parsedChunks;
      });

      const embeddings = await step.run("Generate embeddings", async () => embedTexts(chunks));

      const insertedChunks = await step.run("Persist chunks", async () => {
        await supabase.from("document_topics").delete().eq("document_id", documentId);
        await supabase.from("chunks").delete().eq("document_id", documentId);

        const rows = chunks.map((chunk, index) => ({
          document_id: documentId,
          text_content: chunk,
          chunk_index: index,
          embedding: toVectorLiteral(embeddings[index]),
        }));

        const { data, error } = await supabase.from("chunks").insert(rows).select("id, chunk_index");
        if (error) throw new Error("Chunk persistence failed");
        return (data ?? []) as Array<{ id: string; chunk_index: number }>;
      });

      const topics = await step.run("Extract topics", async () => extractTopicsFromChunks(chunks, filename));

      await step.run("Persist topics", async () => {
        if (!topics.length) return;

        const chunkIdByIndex = new Map(insertedChunks.map((chunk) => [chunk.chunk_index, chunk.id]));
        const rows = topics.map((topic) => ({
          user_id: userId,
          document_id: documentId,
          topic: topic.topic,
          frequency: topic.frequency,
          score: topic.score,
          source_chunk_id: topic.sourceChunkIndex === undefined ? null : chunkIdByIndex.get(topic.sourceChunkIndex) ?? null,
        }));

        const { error } = await supabase.from("document_topics").insert(rows);
        if (error) throw new Error("Topic persistence failed");
      });

      await step.run("Mark indexed", async () => {
        const { error } = await supabase
          .from("documents")
          .update({
            processing_status: "indexed",
            processing_error: null,
            indexed_at: new Date().toISOString(),
          })
          .eq("id", documentId)
          .eq("user_id", userId);
        if (error) throw new Error("Could not mark document as indexed");
      });

      return {
        documentId,
        status: "indexed",
        chunksCreated: insertedChunks.length,
        topicsCreated: topics.length,
      };
    } catch (error) {
      await markDocumentFailed(documentId, error);
      throw error;
    }
  },
);
