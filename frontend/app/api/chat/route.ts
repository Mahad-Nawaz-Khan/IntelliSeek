import { after } from "next/server";

import type { ChatRetrievalHint, SourceCitation } from "../../../lib/chat-api";
import { normalizeSourceCitations } from "../../../lib/source-citations";
import { streamAgentAnswer, streamGeneralAgentAnswer, streamGroundedAgentAnswer, type AgentAnswerStreamEvent, type ConversationTurn } from "../../../lib/server/agents/chat-agent";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import {
  forgetChatJobCancelled,
  forgetChatJobCancelledInDb,
  isChatJobCancelledInDb,
  isChatJobCancelledInMemory,
} from "../../../lib/server/chat-jobs";
import { toClientErrorMessage } from "../../../lib/server/client-errors";
import { generateGroqChatTitle } from "../../../lib/server/groq";
import { createRequestLogger, type LogData, type RequestLogger } from "../../../lib/server/logger";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../lib/server/rate-limit";
import {
  filterRelevantContext,
  hasIndexedDocuments,
  isDocumentSummaryRequest,
  mergeRetrievedContext,
  retrieveContext,
  retrieveContextFromDocumentIds,
  retrieveDocumentContextByIds,
  retrieveKeywordContext,
  retrieveRepresentativeDocumentContext,
  validateQuestion,
  type RetrievedContext,
} from "../../../lib/server/rag/retriever";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

type ChatRequestBody = {
  question?: unknown;
  retrievalHint?: unknown;
  chatSessionId?: unknown;
};

type ChatSessionRow = {
  id: string;
  title: string;
  title_status: "pending" | "generated" | "fallback";
};

type ChatHistoryContextRow = {
  question: string;
  answer: string;
  created_at: string;
};

const encoder = new TextEncoder();

function failure(status: number, error: string, log?: RequestLogger, data: LogData = {}) {
  log?.warn("request.failed", { errorCategory: "unknown", status, error, ...data });
  return Response.json(
    { ok: false, status: "Chat request failed", error },
    { status },
  );
}

function toSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function parseRetrievalHint(value: unknown): ChatRetrievalHint | undefined {
  if (!value || typeof value !== "object") return undefined;

  const hint = value as Record<string, unknown>;
  if (hint.source !== "uploaded") return undefined;

  if (hint.kind === "document" && typeof hint.documentId === "string" && hint.documentId.length <= 80) {
    return {
      source: "uploaded",
      kind: "document",
      documentId: hint.documentId,
    };
  }

  if (hint.kind === "topic" && typeof hint.topic === "string" && Array.isArray(hint.documentIds)) {
    const documentIds = hint.documentIds
      .filter((id): id is string => typeof id === "string" && id.length <= 80)
      .slice(0, 4);

    if (!documentIds.length) return undefined;

    return {
      source: "uploaded",
      kind: "topic",
      topic: hint.topic.slice(0, 200),
      topicId: typeof hint.topicId === "string" && hint.topicId.length <= 120 ? hint.topicId : undefined,
      documentIds,
    };
  }

  return undefined;
}

function isLikelyUploadedMaterialRequest(question: string) {
  return /\b(uploaded|document|documents|file|files|notes|material|source|sources)\b/i.test(question);
}

function parseChatSessionId(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Invalid chat session id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Invalid chat session id");
  }
  return value;
}

function fallbackTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  return (normalized.length > 80 ? `${normalized.slice(0, 77).trim()}...` : normalized) || "New chat";
}

async function createChatSession(userId: string, log?: RequestLogger): Promise<ChatSessionRow> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service client is not configured");

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId })
    .select("id, title, title_status")
    .single();

  if (error || !data) {
    log?.error("chat_sessions.insert.failed", { errorCategory: "supabase_insert", userId, error });
    throw new Error("Could not create chat session");
  }

  return data as ChatSessionRow;
}

async function getOwnedChatSession(sessionId: string, userId: string, log?: RequestLogger): Promise<ChatSessionRow> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service client is not configured");

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, title, title_status")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    log?.warn("chat_sessions.select.not_found", { errorCategory: "auth_failure", userId, sessionId, error });
    throw new Error("Chat session was not found");
  }

  return data as ChatSessionRow;
}

async function getRecentConversationContext(userId: string, chatSessionId: string, log?: RequestLogger): Promise<ConversationTurn[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("chat_history")
    .select("question, answer, created_at")
    .eq("user_id", userId)
    .eq("chat_session_id", chatSessionId)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    log?.warn("chat_history.context.failed", { errorCategory: "supabase_query", userId, sessionId: chatSessionId, error });
    return [];
  }

  return ((data ?? []) as ChatHistoryContextRow[])
    .reverse()
    .map((row) => ({ question: row.question, answer: row.answer }));
}

async function updateChatSessionTimestamp(userId: string, chatSessionId: string, log?: RequestLogger) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatSessionId)
    .eq("user_id", userId);

  if (error) log?.warn("chat_sessions.touch.failed", { errorCategory: "supabase_query", userId, sessionId: chatSessionId, error });
}

/** Returns the stored title, or `null` if nothing could be stored. */
async function generateAndStoreTitle(
  chatSessionId: string,
  userId: string,
  question: string,
  answer: string,
  log?: RequestLogger,
): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  try {
    const title = await generateGroqChatTitle(question, answer);
    const { error } = await supabase
      .from("chat_sessions")
      .update({ title, title_status: "generated", updated_at: new Date().toISOString() })
      .eq("id", chatSessionId)
      .eq("user_id", userId)
      .eq("title_status", "pending");
    if (error) throw error;
    return title;
  } catch (error) {
    return storeFallbackTitle(chatSessionId, userId, question, log, error);
  }
}

/** Writes the derived-from-question title without a model call. */
async function storeFallbackTitle(
  chatSessionId: string,
  userId: string,
  question: string,
  log?: RequestLogger,
  cause?: unknown,
): Promise<string | null> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return null;

  const title = fallbackTitle(question);
  const { error: fallbackError } = await supabase
    .from("chat_sessions")
    .update({ title, title_status: "fallback", updated_at: new Date().toISOString() })
    .eq("id", chatSessionId)
    .eq("user_id", userId)
    .eq("title_status", "pending");
  if (cause) {
    log?.warn("chat_sessions.title.failed", { errorCategory: "unknown", userId, sessionId: chatSessionId, error: cause, fallbackError });
  }
  return fallbackError ? null : title;
}

async function saveChatHistory(question: string, answer: string, sources: SourceCitation[], userId: string, chatSessionId: string, log?: RequestLogger) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    log?.error("chat_history.insert.client_unavailable", { errorCategory: "supabase_insert", userId });
    return;
  }

  const { error } = await supabase.from("chat_history").insert({
    user_id: userId,
    chat_session_id: chatSessionId,
    question,
    answer,
    sources_cited: sources,
  });

  if (error) {
    log?.error("chat_history.insert.failed", {
      errorCategory: "supabase_insert",
      userId,
      sourceCount: sources.length,
      error,
    });
    return;
  }

  log?.info("chat_history.insert.complete", { userId, sourceCount: sources.length });
}

type SseSend = (event: string, data: unknown) => void;

/** How often the generating job checks whether the user pressed Stop. */
const CANCEL_CHECK_INTERVAL_MS = 1_500;

async function finalizeStreamAnswer(options: {
  event: Extract<AgentAnswerStreamEvent, { type: "done" }>;
  question: string;
  userId: string;
  chatSessionId: string;
  shouldGenerateTitle: boolean;
  send: SseSend;
  log?: RequestLogger;
}) {
  const { event, question, userId, chatSessionId, shouldGenerateTitle, send, log } = options;
  const answer = event.answer.trim();
  if (!answer) throw new Error("Agent answer generation returned no content");

  const sources = normalizeSourceCitations(event.sources);
  send("sources", { sources });
  await saveChatHistory(question, answer, sources, userId, chatSessionId, log);
  await updateChatSessionTimestamp(userId, chatSessionId, log);
  send("done", { answer, sources, chatSessionId });
  log?.info("stream.complete", { userId, sourceCount: sources.length, answerLength: answer.length });

  if (shouldGenerateTitle) {
    const title = await generateAndStoreTitle(chatSessionId, userId, question, answer, log);
    if (title) send("title", { chatSessionId, title });
  }
}

async function handleCancelledStream(options: {
  partialAnswer: string;
  question: string;
  userId: string;
  chatSessionId: string;
  shouldGenerateTitle: boolean;
  log?: RequestLogger;
}) {
  const { partialAnswer, question, userId, chatSessionId, shouldGenerateTitle, log } = options;
  const partial = partialAnswer.trim();
  if (partial) {
    await saveChatHistory(question, partial, [], userId, chatSessionId, log);
    await updateChatSessionTimestamp(userId, chatSessionId, log);
  }
  if (shouldGenerateTitle) {
    await storeFallbackTitle(chatSessionId, userId, question, log);
  }
  log?.info("stream.cancelled", { userId, sessionId: chatSessionId, partialLength: partial.length });
}

async function streamAnswer(options: {
  send: SseSend;
  jobId: string;
  userId: string;
  question: string;
  chatSessionId: string;
  shouldGenerateTitle: boolean;
  events: AsyncGenerator<AgentAnswerStreamEvent>;
  log?: RequestLogger;
}): Promise<"completed" | "cancelled"> {
  const { send, jobId, userId, question, chatSessionId, shouldGenerateTitle, events, log } = options;

  let lastCancelCheck = 0;
  let cancelled = false;
  let partialAnswer = "";

  const isCancelled = async () => {
    if (isChatJobCancelledInMemory(jobId)) return true;
    if (Date.now() - lastCancelCheck < CANCEL_CHECK_INTERVAL_MS) return false;
    lastCancelCheck = Date.now();
    return isChatJobCancelledInDb(jobId, userId);
  };

  for await (const event of events) {
    if (await isCancelled()) {
      cancelled = true;
      break;
    }

    if (event.type === "delta") {
      partialAnswer += event.text;
      send("delta", { text: event.text });
      continue;
    }

    if (event.type === "reset") {
      partialAnswer = "";
      send("reset", {});
      log?.warn("stream.reset", { errorCategory: "unknown", userId });
      continue;
    }

    await finalizeStreamAnswer({
      event,
      question,
      userId,
      chatSessionId,
      shouldGenerateTitle,
      send,
      log,
    });
    return "completed";
  }

  if (!cancelled) throw new Error("Agent answer generation returned no content");

  await handleCancelledStream({
    partialAnswer,
    question,
    userId,
    chatSessionId,
    shouldGenerateTitle,
    log,
  });
  return "cancelled";
}

function getHintedDocumentCount(retrievalHint?: ChatRetrievalHint): number {
  if (retrievalHint?.kind === "topic") {
    return retrievalHint.documentIds.length;
  }
  if (retrievalHint) {
    return 1;
  }
  return 0;
}

async function retrieveInitialContext(
  retrievalHint: ChatRetrievalHint | undefined,
  userId: string,
  question: string,
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  if (retrievalHint?.kind === "document") {
    return retrieveDocumentContextByIds(userId, [retrievalHint.documentId], 12, log);
  }
  if (retrievalHint?.kind === "topic") {
    return retrieveContextFromDocumentIds(`${retrievalHint.topic}\n${question}`, userId, retrievalHint.documentIds, 8, log);
  }
  return [];
}

async function resolveJobContext(options: {
  retrievalHint?: ChatRetrievalHint;
  userId: string;
  question: string;
  isSummaryRequest: boolean;
  log: RequestLogger;
}): Promise<RetrievedContext[]> {
  const { retrievalHint, userId, question, isSummaryRequest, log } = options;
  let relevantContext = await retrieveInitialContext(retrievalHint, userId, question, log);

  if (retrievalHint) {
    log.info("retrieval.strategy.complete", {
      userId,
      strategy: retrievalHint.kind === "topic" ? "hinted_topic_semantic" : "hinted_documents",
      contextCount: relevantContext.length,
    });
  }

  if (!relevantContext.length && retrievalHint?.kind === "topic") {
    log.info("retrieval.strategy.start", { userId, strategy: "hinted_topic_fallback_documents" });
    relevantContext = await retrieveDocumentContextByIds(userId, retrievalHint.documentIds, 10, log);
    log.info("retrieval.strategy.complete", {
      userId,
      strategy: "hinted_topic_fallback_documents",
      contextCount: relevantContext.length,
    });
  }

  if (!relevantContext.length && isSummaryRequest) {
    log.info("retrieval.strategy.start", { userId, strategy: "representative_summary" });
    relevantContext = await retrieveRepresentativeDocumentContext(userId, 10, question, log);
    log.info("retrieval.strategy.complete", {
      userId,
      strategy: "representative_summary",
      contextCount: relevantContext.length,
    });
  }

  if (!relevantContext.length) {
    log.info("retrieval.strategy.start", { userId, strategy: "hybrid_vector_keyword" });
    const [semanticContext, keywordContext] = await Promise.all([
      retrieveContext(question, userId, 10, log),
      retrieveKeywordContext(question, userId, 8, log),
    ]);
    relevantContext = filterRelevantContext(mergeRetrievedContext(semanticContext, keywordContext), log);
    log.info("retrieval.strategy.complete", {
      userId,
      strategy: "hybrid_vector_keyword",
      contextCount: relevantContext.length,
    });
  }

  return relevantContext;
}

async function selectAnswerModeAndStream(options: {
  question: string;
  userId: string;
  relevantContext: RetrievedContext[];
  conversationContext: ConversationTurn[];
  retrievalHint?: ChatRetrievalHint;
  isSummaryRequest: boolean;
  log: RequestLogger;
}): Promise<{ events: AsyncGenerator<AgentAnswerStreamEvent>; answerMode: "grounded" | "agent" | "general" | "static-warning" }> {
  const { question, userId, relevantContext, conversationContext, retrievalHint, isSummaryRequest, log } = options;

  if (!relevantContext.length && isSummaryRequest && !retrievalHint && await hasIndexedDocuments(userId, log)) {
    return {
      answerMode: "static-warning",
      events: streamStaticAnswer(
        "I found indexed uploaded document metadata, but I could not load any indexed text chunks to summarize. Please re-index the document or upload it again, then try the summary request once indexing finishes.",
      ),
    };
  }

  if (relevantContext.length) {
    return {
      answerMode: "grounded",
      events: streamGroundedAgentAnswer(question, relevantContext, conversationContext, log),
    };
  }

  if (retrievalHint || isLikelyUploadedMaterialRequest(question)) {
    log.info("retrieval.strategy.start", { userId, strategy: "agent_fallback" });
    return {
      answerMode: "agent",
      events: streamAgentAnswer(question, userId, conversationContext),
    };
  }

  log.info("retrieval.strategy.start", { userId, strategy: "general_answer" });
  return {
    answerMode: "general",
    events: streamGeneralAgentAnswer(question, conversationContext, log),
  };
}

/**
 * Generates and persists one answer, independent of the client connection.
 * `send` streams SSE events to whichever client is still listening and
 * silently no-ops once it has disconnected.
 */
async function runAnswerJob(options: {
  send: SseSend;
  jobId: string;
  question: string;
  userId: string;
  requestedChatSessionId?: string;
  retrievalHint?: ChatRetrievalHint;
  log: RequestLogger;
}) {
  const { send, jobId, question, userId, requestedChatSessionId, retrievalHint, log } = options;
  try {
    send("job", { jobId });

    const chatSession = requestedChatSessionId
      ? await getOwnedChatSession(requestedChatSessionId, userId, log)
      : await createChatSession(userId, log);
    const conversationContext = await getRecentConversationContext(userId, chatSession.id, log);
    const shouldGenerateTitle = !requestedChatSessionId && chatSession.title_status === "pending";

    log.info("retrieval.hint", {
      userId,
      hintKind: retrievalHint?.kind,
      hintedDocumentCount: getHintedDocumentCount(retrievalHint),
    });

    const isSummaryRequest = isDocumentSummaryRequest(question);
    const relevantContext = await resolveJobContext({
      retrievalHint,
      userId,
      question,
      isSummaryRequest,
      log,
    });

    const { events, answerMode } = await selectAnswerModeAndStream({
      question,
      userId,
      relevantContext,
      conversationContext,
      retrievalHint,
      isSummaryRequest,
      log,
    });

    log.info("answer.mode.selected", { userId, answerMode, contextCount: relevantContext.length });

    await streamAnswer({ send, jobId, events, question, userId, chatSessionId: chatSession.id, shouldGenerateTitle, log });
  } catch (error) {
    log.error("stream.failed", { errorCategory: "unknown", userId, error });
    // Internal messages name providers, tables, and configuration; only the
    // vetted set above is safe to show a user.
    send("error", { error: toClientErrorMessage(error) });
  } finally {
    // Breaking out of the answer generator on cancellation closes it, which
    // tears down the provider stream; drop the flag so nothing lingers.
    await forgetChatJobCancelledInDb(jobId, userId).then(() => {
      forgetChatJobCancelled(jobId);
    }, () => {
      forgetChatJobCancelled(jobId);
    });
  }
}

async function* streamStaticAnswer(answer: string, sources: SourceCitation[] = []): AsyncGenerator<AgentAnswerStreamEvent> {
  yield { type: "delta", text: answer };
  yield { type: "done", answer, sources };
}

export async function POST(request: Request) {
  const log = createRequestLogger("api.chat");
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch (error) {
    return failure(400, "Invalid JSON request body", log, { errorCategory: "validation", error });
  }

  log.info("request.start", {
    questionLength: typeof body.question === "string" ? body.question.length : undefined,
    hasRetrievalHint: Boolean(body.retrievalHint),
    hasChatSessionId: typeof body.chatSessionId === "string" && Boolean(body.chatSessionId),
  });

  if (typeof body.question !== "string") {
    return failure(400, "Question is required", log, { errorCategory: "validation" });
  }

  const user = await getAuthenticatedUser(log);
  if (!user) return failure(401, "Sign in is required", log, { errorCategory: "auth_failure" });

  const rateLimit = await checkRateLimit({
    key: `chat:${user.id}:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 1000,
    log,
  });
  if (!rateLimit.allowed) {
    log.warn("rate_limit.exceeded", { errorCategory: "rate_limit", userId: user.id });
    return rateLimitResponse(rateLimit);
  }

  let question: string;
  let requestedChatSessionId: string | undefined;
  try {
    question = validateQuestion(body.question);
    requestedChatSessionId = parseChatSessionId(body.chatSessionId);
  } catch (error) {
    return failure(400, error instanceof Error ? error.message : "Invalid question", log, { errorCategory: "validation", userId: user.id, error });
  }

  log.info("request.validated", { userId: user.id, questionLength: question.length });

  const retrievalHint = parseRetrievalHint(body.retrievalHint);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let clientGone = false;
      const send: SseSend = (event, data) => {
        if (clientGone) return;
        try {
          controller.enqueue(toSse(event, data));
        } catch {
          // The client navigated away or closed the tab mid-answer. Stop
          // writing; the job keeps running so the answer is still persisted
          // for the user's next visit to the session.
          clientGone = true;
        }
      };

      const job = runAnswerJob({
        send,
        jobId: crypto.randomUUID(),
        question,
        userId: user.id,
        requestedChatSessionId,
        retrievalHint,
        log,
      }).finally(() => {
        try {
          controller.close();
        } catch {
          // The stream was already torn down with the disconnected client.
        }
      });

      // Pins the serverless invocation until the answer is generated and
      // persisted even when the client disconnects; without it the platform
      // cancels the function at disconnect and the answer would be lost.
      after(() => job);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...rateLimitHeaders(rateLimit),
    },
  });
}
