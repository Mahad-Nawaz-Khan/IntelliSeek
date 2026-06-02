import { getAuthenticatedUser } from "../../../../lib/server/auth";
import { createRequestLogger } from "../../../../lib/server/logger";
import { getSupabaseServiceClient } from "../../../../lib/server/supabase";

export const runtime = "nodejs";

type ChatSessionRow = {
  id: string;
  title: string;
  title_status: "pending" | "generated" | "fallback";
  created_at: string;
  updated_at: string;
};

function failure(status: number, error: string) {
  return Response.json({ ok: false, error }, { status });
}

export async function GET() {
  const log = createRequestLogger("api.chat.sessions");
  const user = await getAuthenticatedUser(log);
  if (!user) return failure(401, "Sign in is required");

  const supabase = getSupabaseServiceClient();
  if (!supabase) return failure(503, "Chat sessions are unavailable");

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("id, title, title_status, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) {
    log.error("chat_sessions.list.failed", { errorCategory: "supabase_query", userId: user.id, error });
    return failure(500, "Could not load recent chats");
  }

  return Response.json({ ok: true, sessions: (data ?? []) as ChatSessionRow[] });
}
