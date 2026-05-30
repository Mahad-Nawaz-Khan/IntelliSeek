import { BUCKET_NAME } from "../../../lib/upload-config";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../lib/server/rate-limit";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  const rateLimit = checkRateLimit({
    key: `documents:get:${user.id}:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

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

  return Response.json({ ok: true, documents: data ?? [] }, { headers: rateLimitHeaders(rateLimit) });
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  const rateLimit = checkRateLimit({
    key: `documents:delete:${user.id}:${getClientIp(request)}`,
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Supabase service client is not configured" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { document_id?: unknown } | null;
  const documentId = typeof body?.document_id === "string" ? body.document_id : "";
  if (!documentId) {
    return Response.json({ ok: false, error: "Document id is required" }, { status: 400 });
  }

  const { data: document, error: lookupError } = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return Response.json({ ok: false, error: "Document lookup failed" }, { status: 500 });
  }

  if (!document) {
    return Response.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  const { error: topicsDeleteError } = await supabase
    .from("document_topics")
    .delete()
    .eq("document_id", document.id)
    .eq("user_id", user.id);

  if (topicsDeleteError) {
    return Response.json({ ok: false, error: "Document autocomplete cleanup failed" }, { status: 500 });
  }

  const { error: chunksDeleteError } = await supabase
    .from("chunks")
    .delete()
    .eq("document_id", document.id);

  if (chunksDeleteError) {
    return Response.json({ ok: false, error: "Document index cleanup failed" }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", document.id)
    .eq("user_id", user.id);

  if (deleteError) {
    return Response.json({ ok: false, error: "Document deletion failed" }, { status: 500 });
  }

  if (typeof document.storage_path === "string" && document.storage_path) {
    await supabase.storage.from(BUCKET_NAME).remove([document.storage_path]);
  }

  return Response.json({ ok: true }, { headers: rateLimitHeaders(rateLimit) });
}
