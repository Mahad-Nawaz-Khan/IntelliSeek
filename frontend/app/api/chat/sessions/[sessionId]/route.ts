import { getAuthenticatedUser } from "../../../../../lib/server/auth";
import { createRequestLogger } from "../../../../../lib/server/logger";
import { getSupabaseServiceClient } from "../../../../../lib/server/supabase";
import { normalizeSourceCitations } from "../../../../../lib/source-citations";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

type ChatHistoryRow = {
  id: string;
  question: string;
  answer: string;
  sources_cited: unknown;
  created_at: string;
};

function failure(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function GET(_request: Request, context: RouteContext) {
  const log = createRequestLogger("api.chat.session");
  const user = await getAuthenticatedUser(log);
  if (!user) return failure(401, "Sign in is required");

  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return failure(400, "Invalid chat session id");

  const supabase = getSupabaseServiceClient();
  if (!supabase) return failure(503, "Chat sessions are unavailable");

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, title, title_status, created_at, updated_at")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) return failure(404, "Chat session was not found");

  const { data: rows, error: historyError } = await supabase
    .from("chat_history")
    .select("id, question, answer, sources_cited, created_at")
    .eq("user_id", user.id)
    .eq("chat_session_id", sessionId)
    .order("created_at", { ascending: true });

  if (historyError) {
    log.error("chat_history.session_load.failed", { errorCategory: "supabase_query", userId: user.id, sessionId, error: historyError });
    return failure(500, "Could not load chat messages");
  }

  const messages = ((rows ?? []) as ChatHistoryRow[]).flatMap((row) => {
    const createdAt = new Date(row.created_at).getTime();
    const sources = Array.isArray(row.sources_cited) ? normalizeSourceCitations(row.sources_cited) : [];
    return [
      {
        id: `user-${row.id}`,
        role: "user",
        content: row.question,
        status: "complete",
        createdAt,
      },
      {
        id: `assistant-${row.id}`,
        role: "assistant",
        content: row.answer,
        sources,
        status: "complete",
        createdAt: createdAt + 1,
      },
    ];
  });

  return Response.json({ ok: true, session, messages });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const log = createRequestLogger("api.chat.session.delete");
  const user = await getAuthenticatedUser(log);
  if (!user) return failure(401, "Sign in is required");

  const { sessionId } = await context.params;
  if (!isUuid(sessionId)) return failure(400, "Invalid chat session id");

  const supabase = getSupabaseServiceClient();
  if (!supabase) return failure(503, "Chat sessions are unavailable");

  const { error, count } = await supabase
    .from("chat_sessions")
    .delete({ count: "exact" })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) {
    log.error("chat_sessions.delete.failed", { errorCategory: "supabase_delete", userId: user.id, sessionId, error });
    return failure(500, "Could not delete chat session");
  }

  if (!count) return failure(404, "Chat session was not found");

  return Response.json({ ok: true });
}
