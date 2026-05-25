import type { SourceCitation } from "../../../lib/chat-api";
import { generateAgentAnswer } from "../../../lib/server/agents/chat-agent";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { generateAnswer as generateGroqAnswer } from "../../../lib/server/groq";
import { retrieveContext, toSourceCitations, validateQuestion } from "../../../lib/server/rag/retriever";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

type ChatRequestBody = {
  question?: unknown;
};

function failure(status: number, error: string) {
  return Response.json(
    { ok: false, status: "Chat request failed", error },
    { status },
  );
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

  let answer: string;
  let sources: SourceCitation[];

  try {
    const agentResult = await generateAgentAnswer(question, user.id);
    answer = agentResult.answer;
    sources = agentResult.sources;
  } catch {
    let context;
    try {
      context = await retrieveContext(question, user.id);
    } catch {
      return failure(500, "Retrieval failed");
    }

    if (!context.length) {
      return failure(400, "No sufficient context found for this question");
    }

    try {
      answer = await generateGroqAnswer(question, context);
    } catch {
      return failure(500, "Answer generation failed");
    }

    sources = toSourceCitations(context);
  }

  const supabase = getSupabaseServiceClient();
  if (supabase) {
    await supabase.from("chat_history").insert({
      user_id: user.id,
      question,
      answer,
      sources_cited: sources,
    });
  }

  return Response.json({ ok: true, answer, sources });
}
