import { NonRetriableError } from "inngest";
import { BUCKET_NAME } from "../../../upload-config";
import { chunkText, microChunkText } from "../../rag/chunker";
import { EMBEDDING_DIMENSION, embedTexts } from "../../rag/embeddings";
import { extractKeyphrases } from "../../rag/keyphrase-extractor";
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
  if (typeof error === "string") return error.slice(0, 500);
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
  {
    id: "index-document",
    triggers: [{ event: "document/index.requested" }],
    retries: 2,
    onFailure: async ({ event, error }) => {
      const originalEvent = (event.data as { event?: { data?: { documentId?: string } } })?.event;
      const documentId = originalEvent?.data?.documentId;
      if (documentId) {
        const log = createRequestLogger("inngest.index-document.onFailure", `idx_${documentId}`);
        await markDocumentFailed(documentId, error, log);
      }
    },
  },
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

        if (error || !data) {
          throw new NonRetriableError("Document not found");
        }
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
        if (error || !data) {
          const rawMessage = error?.message ?? "Stored file not found";
          const isNotFound =
            rawMessage.toLowerCase().includes("not found") ||
            (error as { statusCode?: string })?.statusCode === "404";

          const userFacingError = isNotFound
            ? "Uploaded file was not found in storage. Please upload the document again."
            : `Storage download failed: ${rawMessage}`;

          await markDocumentFailed(documentId, userFacingError, log);

          if (isNotFound) {
            throw new NonRetriableError(userFacingError);
          }
          throw new Error(userFacingError);
        }
        log.info("indexing.storage_download.complete", { userId, documentId });
        const text = await extractTextFromBuffer(await data.arrayBuffer(), filename, fileType, log);
        log.info("indexing.parse.complete", { userId, documentId, textLength: text.length });
        return text;
      });

      const chunks = await step.run("Chunk document", async () => {
        // Blank chunks are dropped here rather than downstream: the embedder
        // returns one vector per input, so filtering after embedding would shift
        // vectors onto the wrong chunks.
        const parsedChunks = chunkText(extracted).map((chunk) => chunk.trim()).filter(Boolean);
        const withoutPageMarkers =
          fileType === "application/pdf"
            ? extracted.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "").trim()
            : extracted.trim();

        if (!parsedChunks.length || (fileType === "application/pdf" && !withoutPageMarkers)) {
          const errorMsg =
            fileType === "application/pdf"
              ? "No text could be extracted from this PDF even after OCR. Please check that the document is legible."
              : "No text could be extracted from this file";
          await markDocumentFailed(documentId, errorMsg, log);
          throw new NonRetriableError(errorMsg);
        }

        log.info("indexing.chunk.complete", { userId, documentId, textLength: extracted.length, chunkCount: parsedChunks.length });
        return parsedChunks;
      });

      const embeddings = await step.run("Generate embeddings", async () => {
        const generated = await embedTexts(chunks, log);
        if (generated.length !== chunks.length) {
          log.error("indexing.embeddings.count_mismatch", {
            errorCategory: "embedding_failure",
            userId,
            documentId,
            chunkCount: chunks.length,
            embeddingCount: generated.length,
          });
          const errorMsg = "Embedding count does not match chunk count";
          await markDocumentFailed(documentId, errorMsg, log);
          throw new NonRetriableError(errorMsg);
        }
        log.info("indexing.embeddings.complete", { userId, documentId, chunkCount: chunks.length, embeddingCount: generated.length });
        return generated;
      });

      const topics = await step.run("Extract topics", async () => {
        const extractedTopics = extractTopicsFromChunks(chunks, filename);
        log.info("indexing.topics.extract.complete", { userId, documentId, topicCount: extractedTopics.length });
        return extractedTopics;
      });

      const keyphrases = await step.run("Extract keyphrases", async () => {
        const extractedKeyphrases = extractKeyphrases(chunks, { limit: 60 });
        log.info("indexing.keyphrases.extract.complete", { userId, documentId, keyphraseCount: extractedKeyphrases.length });
        return extractedKeyphrases;
      });

      // Chunks and metadata are replaced in one step.
      const insertedChunks = await step.run("Persist chunks and topics", async () => {
        const { error: topicDeleteError } = await supabase.from("document_topics").delete().eq("document_id", documentId);
        if (topicDeleteError) {
          log.error("indexing.topics.delete_failed", { errorCategory: "supabase_delete", userId, documentId, error: topicDeleteError });
          throw new Error("Could not clear previous topics");
        }

        const { error: keyphraseDeleteError } = await supabase.from("document_keyphrases").delete().eq("document_id", documentId);
        if (keyphraseDeleteError) {
          log.warn("indexing.keyphrases.delete_failed", { errorCategory: "supabase_delete", userId, documentId, error: keyphraseDeleteError });
        }

        const { error: chunkDeleteError } = await supabase.from("chunks").delete().eq("document_id", documentId);
        if (chunkDeleteError) {
          log.error("indexing.chunks.delete_failed", { errorCategory: "supabase_delete", userId, documentId, error: chunkDeleteError });
          throw new Error("Could not clear previous chunks");
        }

        const rows = chunks.map((chunk, index) => ({
          document_id: documentId,
          text_content: chunk,
          chunk_index: index,
          embedding: toVectorLiteral(embeddings[index]),
        }));

        const { data, error } = await supabase.from("chunks").insert(rows).select("id, chunk_index");
        if (error) {
          log.error("indexing.chunks.insert_failed", { errorCategory: "supabase_insert", userId, documentId, error });
          throw new Error("Chunk persistence failed");
        }

        const persistedChunks = (data ?? []) as Array<{ id: string; chunk_index: number }>;
        log.info("indexing.chunks.persist.complete", {
          userId,
          documentId,
          chunkCount: chunks.length,
          insertedChunkCount: persistedChunks.length,
        });

        if (topics.length) {
          const chunkIdByIndex = new Map(persistedChunks.map((chunk) => [chunk.chunk_index, chunk.id]));
          const topicRows = topics.map((topic) => ({
            user_id: userId,
            document_id: documentId,
            topic: topic.topic,
            frequency: topic.frequency,
            score: topic.score,
            source_chunk_id: topic.sourceChunkIndex === undefined ? null : chunkIdByIndex.get(topic.sourceChunkIndex) ?? null,
          }));

          const { error: topicError } = await supabase.from("document_topics").insert(topicRows);
          if (topicError) {
            log.error("indexing.topics.insert_failed", { errorCategory: "supabase_insert", userId, documentId, error: topicError });
            throw new Error("Topic persistence failed");
          }
          log.info("indexing.topics.persist.complete", { userId, documentId, topicCount: topics.length });
        } else {
          log.info("indexing.topics.persist.skipped", { userId, documentId, topicCount: 0 });
        }

        if (keyphrases.length) {
          const keyphraseRows = keyphrases.map((kp) => ({
            user_id: userId,
            document_id: documentId,
            phrase: kp.phrase,
            score: kp.score,
            source: kp.source,
          }));

          const { error: kpError } = await supabase.from("document_keyphrases").insert(keyphraseRows);
          if (kpError) {
            log.warn("indexing.keyphrases.insert_failed", { errorCategory: "supabase_insert", userId, documentId, error: kpError });
          } else {
            log.info("indexing.keyphrases.persist.complete", { userId, documentId, keyphraseCount: keyphrases.length });
          }
        }

        return persistedChunks;
      });

      await step.run("Create micro-chunks", async () => {
        const microChunks = microChunkText(extracted);
        if (!microChunks.length) {
          log.info("indexing.micro_chunks.skipped", { userId, documentId, reason: "none_extracted" });
          return;
        }

        // Limit micro-chunks to at most 120 per document to control embedding costs while providing granular precision
        const targetMicroChunks = microChunks.slice(0, 120);
        const microTexts = targetMicroChunks.map((mc) => mc.text);
        const microEmbeddings = await embedTexts(microTexts, log);

        const chunkIdByIndex = new Map(insertedChunks.map((chunk) => [chunk.chunk_index, chunk.id]));
        const microRows = targetMicroChunks.map((mc, idx) => ({
          document_id: documentId,
          parent_chunk_id: chunkIdByIndex.get(mc.parentChunkIndex) ?? null,
          text_content: mc.text,
          chunk_index: idx,
          embedding: toVectorLiteral(microEmbeddings[idx]),
        }));

        await supabase.from("micro_chunks").delete().eq("document_id", documentId);
        const { error: mcError } = await supabase.from("micro_chunks").insert(microRows);
        if (mcError) {
          log.warn("indexing.micro_chunks.insert_failed", { errorCategory: "supabase_insert", userId, documentId, error: mcError });
        } else {
          log.info("indexing.micro_chunks.persist.complete", { userId, documentId, microCount: microRows.length });
        }
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
