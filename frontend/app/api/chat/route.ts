import type { ChatRetrievalHint, SourceCitation } from "../../../lib/chat-api";
import { streamAgentAnswer, streamGeneralAgentAnswer, streamGroundedAgentAnswer, type AgentAnswerStreamEvent } from "../../../lib/server/agents/chat-agent";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../lib/server/rate-limit";
import {
  filterRelevantContext,
  hasIndexedDocuments,
  isDocumentSummaryRequest,
  retrieveContext,
  retrieveDocumentContextByIds,
  retrieveRepresentativeDocumentContext,
  validateQuestion,
} from "../../../lib/server/rag/retriever";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

type ChatRequestBody = {
  question?: unknown;
  retrievalHint?: unknown;
};

const encoder = new TextEncoder();

function failure(status: number, error: string) {
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

async function saveChatHistory(question: string, answer: string, sources: SourceCitation[], userId: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return;

  await supabase.from("chat_history").insert({
    user_id: userId,
    question,
    answer,
    sources_cited: sources,
  });
}

async function streamAnswer(
  controller: ReadableStreamDefaultController<Uint8Array>,
  events: AsyncGenerator<AgentAnswerStreamEvent>,
  question: string,
  userId: string,
) {
  for await (const event of events) {
    if (event.type === "delta") {
      controller.enqueue(toSse("delta", { text: event.text }));
      continue;
    }

    controller.enqueue(toSse("sources", { sources: event.sources }));
    await saveChatHistory(question, event.answer, event.sources, userId);
    controller.enqueue(toSse("done", { answer: event.answer, sources: event.sources }));
    return;
  }

  throw new Error("Agent answer generation returned no content");
}

async function* streamStaticAnswer(answer: string, sources: SourceCitation[] = []): AsyncGenerator<AgentAnswerStreamEvent> {
  yield { type: "delta", text: answer };
  yield { type: "done", answer, sources };
}

export async function POST(request: Request) {
  let body: ChatRequestBody;

  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return failure(400, "Invalid JSON request body");
  }

  if (typeof body.question !== "string") {
    return failure(400, "Question is required");
  }

  const user = await getAuthenticatedUser();
  if (!user) return failure(401, "Sign in is required");

  const rateLimit = await checkRateLimit({
    key: `chat:${user.id}:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  let question: string;
  try {
    question = validateQuestion(body.question);
  } catch (error) {
    return failure(400, error instanceof Error ? error.message : "Invalid question");
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const retrievalHint = parseRetrievalHint(body.retrievalHint);
        const isSummaryRequest = isDocumentSummaryRequest(question);
        let relevantContext = retrievalHint?.kind === "document"
          ? await retrieveDocumentContextByIds(user.id, [retrievalHint.documentId], 12)
          : retrievalHint?.kind === "topic"
            ? await retrieveDocumentContextByIds(user.id, retrievalHint.documentIds, 10)
            : [];

        if (!relevantContext.length && isSummaryRequest) {
          relevantContext = await retrieveRepresentativeDocumentContext(user.id, 10, question);
        }

        if (!relevantContext.length) {
          const context = await retrieveContext(question, user.id, 8);
          relevantContext = filterRelevantContext(context);
        }

        let events: AsyncGenerator<AgentAnswerStreamEvent>;
        if (relevantContext.length) {
          events = streamGroundedAgentAnswer(question, relevantContext);
        } else if (retrievalHint || isLikelyUploadedMaterialRequest(question)) {
          events = streamAgentAnswer(question, user.id);
        } else {
          events = streamGeneralAgentAnswer(question);
        }

        if (!relevantContext.length && isSummaryRequest && !retrievalHint && await hasIndexedDocuments(user.id)) {
          events = streamStaticAnswer(
            "I found indexed uploaded document metadata, but I could not load any indexed text chunks to summarize. Please re-index the document or upload it again, then try the summary request once indexing finishes.",
          );
        }

        await streamAnswer(controller, events, question, user.id);
      } catch (error) {
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
