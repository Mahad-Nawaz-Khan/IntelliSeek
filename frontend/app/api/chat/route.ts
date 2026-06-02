import type { ChatRetrievalHint, SourceCitation } from "../../../lib/chat-api";
import { normalizeSourceCitations } from "../../../lib/source-citations";
import { streamAgentAnswer, streamGeneralAgentAnswer, streamGroundedAgentAnswer, type AgentAnswerStreamEvent, type ConversationTurn } from "../../../lib/server/agents/chat-agent";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { generateGroqChatTitle } from "../../../lib/server/groq";
import { createRequestLogger, type LogData, type RequestLogger } from "../../../lib/server/logger";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../lib/server/rate-limit";
import {
  filterRelevantContext,
  hasIndexedDocuments,
  isDocumentSummaryRequest,
  retrieveContext,
  retrieveContextFromDocumentIds,
  retrieveDocumentContextByIds,
  retrieveRepresentativeDocumentContext,
  validateQuestion,
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

async function generateAndStoreTitle(chatSessionId: string, userId: string, question: string, answer: string, log?: RequestLogger) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  try {
    const title = await generateGroqChatTitle(question, answer);
    const { error } = await supabase
      .from("chat_sessions")
      .update({ title, title_status: "generated", updated_at: new Date().toISOString() })
      .eq("id", chatSessionId)
      .eq("user_id", userId)
      .eq("title_status", "pending");
    if (error) throw error;
  } catch (error) {
    const { error: fallbackError } = await supabase
      .from("chat_sessions")
      .update({ title: fallbackTitle(question), title_status: "fallback", updated_at: new Date().toISOString() })
      .eq("id", chatSessionId)
      .eq("user_id", userId)
      .eq("title_status", "pending");
    log?.warn("chat_sessions.title.failed", { errorCategory: "unknown", userId, sessionId: chatSessionId, error, fallbackError });
  }
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

async function streamAnswer(
  controller: ReadableStreamDefaultController<Uint8Array>,
  events: AsyncGenerator<AgentAnswerStreamEvent>,
  question: string,
  userId: string,
  chatSessionId: string,
  shouldGenerateTitle: boolean,
  log?: RequestLogger,
) {
  for await (const event of events) {
    if (event.type === "delta") {
      controller.enqueue(toSse("delta", { text: event.text }));
      continue;
    }

    const sources = normalizeSourceCitations(event.sources);
    controller.enqueue(toSse("sources", { sources }));
    await saveChatHistory(question, event.answer, sources, userId, chatSessionId, log);
    await updateChatSessionTimestamp(userId, chatSessionId, log);
    if (shouldGenerateTitle) void generateAndStoreTitle(chatSessionId, userId, question, event.answer, log);
    controller.enqueue(toSse("done", { answer: event.answer, sources, chatSessionId }));
    log?.info("stream.complete", { userId, sourceCount: sources.length, answerLength: event.answer.length });
    return;
  }

  throw new Error("Agent answer generation returned no content");
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const retrievalHint = parseRetrievalHint(body.retrievalHint);
        const chatSession = requestedChatSessionId
          ? await getOwnedChatSession(requestedChatSessionId, user.id, log)
          : await createChatSession(user.id, log);
        const conversationContext = await getRecentConversationContext(user.id, chatSession.id, log);
        const shouldGenerateTitle = !requestedChatSessionId && chatSession.title_status === "pending";
        log.info("retrieval.hint", {
          userId: user.id,
          hintKind: retrievalHint?.kind,
          hintedDocumentCount: retrievalHint?.kind === "topic" ? retrievalHint.documentIds.length : retrievalHint ? 1 : 0,
        });
        const isSummaryRequest = isDocumentSummaryRequest(question);
        let relevantContext = retrievalHint?.kind === "document"
          ? await retrieveDocumentContextByIds(user.id, [retrievalHint.documentId], 12, log)
          : retrievalHint?.kind === "topic"
            ? await retrieveContextFromDocumentIds(`${retrievalHint.topic}\n${question}`, user.id, retrievalHint.documentIds, 8, log)
            : [];
        if (retrievalHint) {
          log.info("retrieval.strategy.complete", {
            userId: user.id,
            strategy: retrievalHint.kind === "topic" ? "hinted_topic_semantic" : "hinted_documents",
            contextCount: relevantContext.length,
          });
        }

        if (!relevantContext.length && retrievalHint?.kind === "topic") {
          log.info("retrieval.strategy.start", { userId: user.id, strategy: "hinted_topic_fallback_documents" });
          relevantContext = await retrieveDocumentContextByIds(user.id, retrievalHint.documentIds, 10, log);
          log.info("retrieval.strategy.complete", {
            userId: user.id,
            strategy: "hinted_topic_fallback_documents",
            contextCount: relevantContext.length,
          });
        }

        if (!relevantContext.length && isSummaryRequest) {
          log.info("retrieval.strategy.start", { userId: user.id, strategy: "representative_summary" });
          relevantContext = await retrieveRepresentativeDocumentContext(user.id, 10, question, log);
          log.info("retrieval.strategy.complete", {
            userId: user.id,
            strategy: "representative_summary",
            contextCount: relevantContext.length,
          });
        }

        if (!relevantContext.length) {
          log.info("retrieval.strategy.start", { userId: user.id, strategy: "semantic_vector" });
          const context = await retrieveContext(question, user.id, 8, log);
          relevantContext = filterRelevantContext(context, log);
          log.info("retrieval.strategy.complete", {
            userId: user.id,
            strategy: "semantic_vector",
            contextCount: relevantContext.length,
          });
        }

        let events: AsyncGenerator<AgentAnswerStreamEvent>;
        let answerMode: "grounded" | "agent" | "general" | "static-warning";
        if (relevantContext.length) {
          answerMode = "grounded";
          events = streamGroundedAgentAnswer(question, relevantContext, conversationContext);
        } else if (retrievalHint || isLikelyUploadedMaterialRequest(question)) {
          answerMode = "agent";
          log.info("retrieval.strategy.start", { userId: user.id, strategy: "agent_fallback" });
          events = streamAgentAnswer(question, user.id, conversationContext);
        } else {
          answerMode = "general";
          log.info("retrieval.strategy.start", { userId: user.id, strategy: "general_answer" });
          events = streamGeneralAgentAnswer(question, conversationContext);
        }

        if (!relevantContext.length && isSummaryRequest && !retrievalHint && await hasIndexedDocuments(user.id, log)) {
          answerMode = "static-warning";
          events = streamStaticAnswer(
            "I found indexed uploaded document metadata, but I could not load any indexed text chunks to summarize. Please re-index the document or upload it again, then try the summary request once indexing finishes.",
          );
        }

        log.info("answer.mode.selected", { userId: user.id, answerMode, contextCount: relevantContext.length });

        await streamAnswer(controller, events, question, user.id, chatSession.id, shouldGenerateTitle, log);
      } catch (error) {
        log.error("stream.failed", { errorCategory: "unknown", userId: user.id, error });
        controller.enqueue(toSse("error", {
          error: error instanceof Error ? error.message : "The assistant could not answer this question.",
        }));
      } finally {
        controller.close();
      }
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
