import { BUCKET_NAME } from "../../../upload-config";
import { chunkText } from "../../rag/chunker";
import { EMBEDDING_DIMENSION, embedTexts } from "../../rag/embeddings";
import { extractTextFromBuffer } from "../../rag/parser";
import { extractTopicsFromChunks } from "../../rag/topics";
import { createRequestLogger, type RequestLogger } from "../../logger";
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

async function markDocumentFailed(documentId: string, error: unknown, log?: RequestLogger) {
  log?.error("indexing.failed", { errorCategory: "indexing", documentId, error });
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    log?.error("indexing.mark_failed.client_unavailable", { errorCategory: "supabase_insert", documentId });
    return;
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      processing_status: "failed",
      processing_error: safeErrorMessage(error),
    })
    .eq("id", documentId);

  if (updateError) {
    log?.error("indexing.mark_failed.update_failed", { errorCategory: "supabase_insert", documentId, error: updateError });
  }
}

export const indexDocument = inngest.createFunction(
  { id: "index-document", triggers: [{ event: "document/index.requested" }] },
  async ({ event, step }) => {
    const { userId, documentId, storagePath, filename, fileType } = event.data;
    const log = createRequestLogger("inngest.index-document", `idx_${documentId}`);
    log.info("indexing.start", { userId, documentId, fileType });
    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      log.error("indexing.client_unavailable", { errorCategory: "supabase_query", userId, documentId });
      throw new Error("Supabase service client is not configured");
    }

    try {
      const document = await step.run("Load document", async () => {
        const { data, error } = await supabase
          .from("documents")
          .select("id, user_id, processing_status")
          .eq("id", documentId)
          .eq("user_id", userId)
          .single();

        if (error || !data) throw new Error("Document not found");
        log.info("indexing.load_document.complete", { userId, documentId, processingStatus: data.processing_status });
        return data as { id: string; user_id: string; processing_status: string };
      });

      if (document.processing_status === "indexed") {
        log.info("indexing.already_indexed", { userId, documentId });
        return { documentId, status: "indexed" };
      }

      await step.run("Mark processing", async () => {
        const { error } = await supabase
          .from("documents")
          .update({ processing_status: "processing", processing_error: null })
          .eq("id", documentId)
          .eq("user_id", userId);
        if (error) throw new Error("Could not mark document as processing");
        log.info("indexing.mark_processing.complete", { userId, documentId });
      });

      const extracted = await step.run("Parse document", async () => {
        const { data, error } = await supabase.storage.from(BUCKET_NAME).download(storagePath);
        if (error || !data) throw new Error(error?.message ?? "Stored file not found");
        log.info("indexing.storage_download.complete", { userId, documentId });
        const text = await extractTextFromBuffer(await data.arrayBuffer(), filename, fileType);
        log.info("indexing.parse.complete", { userId, documentId, textLength: text.length });
        return text;
      });

      const chunks = await step.run("Chunk document", async () => {
        const parsedChunks = chunkText(extracted);
        if (!parsedChunks.length) throw new Error("Extracted text has no indexable content");
        log.info("indexing.chunk.complete", { userId, documentId, textLength: extracted.length, chunkCount: parsedChunks.length });
        return parsedChunks;
      });

      const embeddings = await step.run("Generate embeddings", async () => {
        const generated = await embedTexts(chunks, log);
        log.info("indexing.embeddings.complete", { userId, documentId, chunkCount: chunks.length, embeddingCount: generated.length });
        return generated;
      });

      const insertedChunks = await step.run("Persist chunks", async () => {
        const { error: topicDeleteError } = await supabase.from("document_topics").delete().eq("document_id", documentId);
        if (topicDeleteError) log.error("indexing.topics.delete_failed", { errorCategory: "supabase_delete", userId, documentId, error: topicDeleteError });
        const { error: chunkDeleteError } = await supabase.from("chunks").delete().eq("document_id", documentId);
        if (chunkDeleteError) log.error("indexing.chunks.delete_failed", { errorCategory: "supabase_delete", userId, documentId, error: chunkDeleteError });

        const rows = chunks.map((chunk, index) => ({
          document_id: documentId,
          text_content: chunk,
          chunk_index: index,
          embedding: toVectorLiteral(embeddings[index]),
        }));

        const { data, error } = await supabase.from("chunks").insert(rows).select("id, chunk_index");
        if (error) throw new Error("Chunk persistence failed");
        log.info("indexing.chunks.persist.complete", {
          userId,
          documentId,
          chunkCount: chunks.length,
          insertedChunkCount: data?.length ?? 0,
        });
        return (data ?? []) as Array<{ id: string; chunk_index: number }>;
      });

      const topics = await step.run("Extract topics", async () => {
        const extractedTopics = extractTopicsFromChunks(chunks, filename);
        log.info("indexing.topics.extract.complete", { userId, documentId, topicCount: extractedTopics.length });
        return extractedTopics;
      });

      await step.run("Persist topics", async () => {
        if (!topics.length) {
          log.info("indexing.topics.persist.skipped", { userId, documentId, topicCount: 0 });
          return;
        }

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
        log.info("indexing.topics.persist.complete", { userId, documentId, topicCount: topics.length });
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
        log.info("indexing.mark_indexed.complete", { userId, documentId });
      });

      log.info("indexing.complete", {
        userId,
        documentId,
        chunkCount: chunks.length,
        embeddingCount: embeddings.length,
        insertedChunkCount: insertedChunks.length,
        topicCount: topics.length,
      });

      return {
        documentId,
        status: "indexed",
        chunksCreated: insertedChunks.length,
        topicsCreated: topics.length,
      };
    } catch (error) {
      await markDocumentFailed(documentId, error, log);
      throw error;
    }
  },
);
