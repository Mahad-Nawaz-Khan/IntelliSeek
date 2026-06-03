import { normalizeSourceCitations } from "../../../../lib/source-citations";
import { streamGeneralAgentAnswer, streamGroundedAgentAnswer, type AgentAnswerStreamEvent } from "../../../../lib/server/agents/chat-agent";
import { createRequestLogger, type RequestLogger } from "../../../../lib/server/logger";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../../lib/server/rate-limit";
import {
  demoHasIndexedDocuments,
  filterRelevantContext,
  isDocumentSummaryRequest,
  mergeRetrievedContext,
  retrieveDemoContext,
  retrieveDemoKeywordContext,
  retrieveDemoRepresentativeDocumentContext,
  validateQuestion,
} from "../../../../lib/server/rag/retriever";

export const runtime = "nodejs";

const encoder = new TextEncoder();

function failure(status: number, error: string, log?: RequestLogger) {
  log?.warn("demo.request.failed", { errorCategory: "unknown", status, error });
  return Response.json(
    { ok: false, status: "Demo request failed", error },
    { status },
  );
}

function toSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function streamDemoAnswer(
  controller: ReadableStreamDefaultController<Uint8Array>,
  events: AsyncGenerator<AgentAnswerStreamEvent>,
  log?: RequestLogger,
) {
  for await (const event of events) {
    if (event.type === "delta") {
      controller.enqueue(toSse("delta", { text: event.text }));
      continue;
    }

    const sources = normalizeSourceCitations(event.sources);
    controller.enqueue(toSse("sources", { sources }));
    controller.enqueue(toSse("done", { answer: event.answer, sources, chatSessionId: undefined }));
    log?.info("demo.stream.complete", { sourceCount: sources.length, answerLength: event.answer.length });
    return;
  }

  throw new Error("Agent answer generation returned no content");
}

export async function POST(request: Request) {
  const log = createRequestLogger("api.chat.demo");
  let body: { question?: unknown; retrievalHint?: unknown };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return failure(400, "Invalid JSON request body", log);
  }

  if (typeof body.question !== "string") {
    return failure(400, "Question is required", log);
  }

  const rateLimit = await checkRateLimit({
    key: `demo-chat:${getClientIp(request)}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    log.warn("demo.rate_limit.exceeded", { errorCategory: "rate_limit" });
    return rateLimitResponse(rateLimit);
  }

  let question: string;
  try {
    question = validateQuestion(body.question);
  } catch (error) {
    return failure(400, error instanceof Error ? error.message : "Invalid question", log);
  }

  log.info("demo.request.validated", { questionLength: question.length });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const isSummaryRequest = isDocumentSummaryRequest(question);

        log.info("demo.retrieval.start", { questionLength: question.length });
        let relevantContext: Awaited<ReturnType<typeof retrieveDemoContext>> = [];

        if (!relevantContext.length && isSummaryRequest) {
          log.info("demo.retrieval.representative", { strategy: "representative_summary" });
          relevantContext = await retrieveDemoRepresentativeDocumentContext(10, question, log);
          log.info("demo.retrieval.complete", { strategy: "representative_summary", contextCount: relevantContext.length });
        }

        if (!relevantContext.length) {
          log.info("demo.retrieval.hybrid", { strategy: "hybrid_vector_keyword" });
          const [semanticContext, keywordContext] = await Promise.all([
            retrieveDemoContext(question, 10, log),
            retrieveDemoKeywordContext(question, 8, log),
          ]);
          relevantContext = filterRelevantContext(mergeRetrievedContext(semanticContext, keywordContext), log);
          log.info("demo.retrieval.complete", { strategy: "hybrid_vector_keyword", contextCount: relevantContext.length });
        }

        let events: AsyncGenerator<AgentAnswerStreamEvent>;
        if (relevantContext.length) {
          events = streamGroundedAgentAnswer(question, relevantContext, []);
        } else {
          events = streamGeneralAgentAnswer(question, []);
        }

        if (!relevantContext.length && isSummaryRequest && await demoHasIndexedDocuments(log)) {
          events = streamGeneralAgentAnswer(question, []);
        }

        await streamDemoAnswer(controller, events, log);
      } catch (error) {
        log.error("demo.stream.failed", { errorCategory: "unknown", error });
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
