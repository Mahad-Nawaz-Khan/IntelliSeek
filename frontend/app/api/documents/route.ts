import { getAuthenticatedUser } from "../../../lib/server/auth";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Supabase service client is not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, created_at, processing_status, processing_error, indexed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ ok: false, error: "Document status lookup failed" }, { status: 500 });
  }

  return Response.json({ ok: true, documents: data ?? [] });
}
