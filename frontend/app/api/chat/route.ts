import type { SourceCitation } from "../../../lib/chat-api";
import { streamAgentAnswer } from "../../../lib/server/agents/chat-agent";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { generateAnswer as generateGroqAnswer } from "../../../lib/server/groq";
import { retrieveContext, toSourceCitations, validateQuestion } from "../../../lib/server/rag/retriever";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

type ChatRequestBody = {
  question?: unknown;
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

async function generateFallbackAnswer(question: string, userId: string) {
  const context = await retrieveContext(question, userId);
  if (!context.length) throw new Error("No sufficient context found for this question");

  return {
    answer: await generateGroqAnswer(question, context),
    sources: toSourceCitations(context),
  };
}

async function streamFallback(controller: ReadableStreamDefaultController<Uint8Array>, question: string, userId: string) {
  const { answer, sources } = await generateFallbackAnswer(question, userId);
  controller.enqueue(toSse("delta", { text: answer }));
  controller.enqueue(toSse("sources", { sources }));
  await saveChatHistory(question, answer, sources, userId);
  controller.enqueue(toSse("done", { answer, sources }));
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

  let question: string;
  try {
    question = validateQuestion(body.question);
  } catch (error) {
    return failure(400, error instanceof Error ? error.message : "Invalid question");
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of streamAgentAnswer(question, user.id)) {
          if (event.type === "delta") {
            controller.enqueue(toSse("delta", { text: event.text }));
            continue;
          }

          controller.enqueue(toSse("sources", { sources: event.sources }));
          await saveChatHistory(question, event.answer, event.sources, user.id);
          controller.enqueue(toSse("done", { answer: event.answer, sources: event.sources }));
          controller.close();
          return;
        }

        throw new Error("Agent answer generation returned no content");
      } catch {
        try {
          await streamFallback(controller, question, user.id);
        } catch (fallbackError) {
          controller.enqueue(toSse("error", {
            error: fallbackError instanceof Error ? fallbackError.message : "The assistant could not answer this question.",
          }));
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
