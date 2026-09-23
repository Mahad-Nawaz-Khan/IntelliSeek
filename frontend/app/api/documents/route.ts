import { BUCKET_NAME } from "../../../lib/upload-config";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../lib/server/rate-limit";
import { accessibleDocumentFilter, isUuid } from "../../../lib/server/postgrest-safe";
import { isAdminUser } from "../../../lib/server/roles";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    key: `documents:get:${user.id}:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Supabase service client is not configured" }, { status: 500 });
  }

  // `user_id` is deliberately not selected: knowledge-base rows are visible to
  // every signed-in user, so returning it would disclose the uploader's id to
  // people who cannot otherwise see it. Nothing in the UI reads it.
  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, created_at, processing_status, processing_error, indexed_at, source_scope")
    .or(accessibleDocumentFilter(user.id))
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return Response.json({ ok: false, error: "Document status lookup failed" }, { status: 500 });
  }

  const STALE_INDEXING_THRESHOLD_MS = 15 * 60 * 1000;
  const now = Date.now();
  const staleDocIds: string[] = [];

  const documents = (data ?? []).map((doc) => {
    const isPending = doc.processing_status === "processing" || doc.processing_status === "queued";
    const ageMs = now - new Date(doc.created_at).getTime();
    if (isPending && ageMs > STALE_INDEXING_THRESHOLD_MS) {
      staleDocIds.push(doc.id);
      return {
        ...doc,
        processing_status: "failed",
        processing_error: doc.processing_error || "Indexing timed out. Please delete and re-upload the document.",
      };
    }
    return doc;
  });

  if (staleDocIds.length > 0) {
    await supabase
      .from("documents")
      .update({
        processing_status: "failed",
        processing_error: "Indexing timed out. Please delete and re-upload the document.",
      })
      .in("id", staleDocIds);
  }

  return Response.json({ ok: true, documents }, { headers: rateLimitHeaders(rateLimit) });
}

import type { User } from "@supabase/supabase-js";

function checkDocumentDeletePermission(
  document: { source_scope: string | null; user_id: string },
  user: User
): { status: number; error: string } | null {
  const isKnowledgeBaseDocument = document.source_scope === "knowledge_base";
  if (isKnowledgeBaseDocument && !isAdminUser(user)) {
    return { status: 403, error: "Only admins can delete knowledge-base documents" };
  }
  if (!isKnowledgeBaseDocument && document.user_id !== user.id) {
    return { status: 404, error: "Document not found" };
  }
  return null;
}

type ServiceSupabase = NonNullable<ReturnType<typeof getSupabaseServiceClient>>;

async function deleteDocumentArtifacts(
  supabase: ServiceSupabase,
  document: { id: string; user_id: string; storage_path: string | null }
): Promise<string | null> {
  const { error: topicsDeleteError } = await supabase
    .from("document_topics")
    .delete()
    .eq("document_id", document.id)
    .eq("user_id", document.user_id);
  if (topicsDeleteError) return "Document autocomplete cleanup failed";

  const { error: chunksDeleteError } = await supabase
    .from("chunks")
    .delete()
    .eq("document_id", document.id);
  if (chunksDeleteError) return "Document index cleanup failed";

  const { error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", document.id)
    .eq("user_id", document.user_id);
  if (deleteError) return "Document deletion failed";

  if (typeof document.storage_path === "string" && document.storage_path) {
    await supabase.storage.from(BUCKET_NAME).remove([document.storage_path]);
  }

  return null;
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
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
  const documentId = typeof body?.document_id === "string" ? body.document_id.trim() : "";
  if (!isUuid(documentId)) {
    return Response.json({ ok: false, error: "A valid document id is required" }, { status: 400 });
  }

  const { data: document, error: lookupError } = await supabase
    .from("documents")
    .select("id, user_id, storage_path, source_scope")
    .eq("id", documentId)
    .maybeSingle();

  if (lookupError) {
    return Response.json({ ok: false, error: "Document lookup failed" }, { status: 500 });
  }

  if (!document) {
    return Response.json({ ok: false, error: "Document not found" }, { status: 404 });
  }

  const permissionError = checkDocumentDeletePermission(document, user);
  if (permissionError) {
    return Response.json({ ok: false, error: permissionError.error }, { status: permissionError.status });
  }

  const cleanupError = await deleteDocumentArtifacts(supabase, document);
  if (cleanupError) {
    return Response.json({ ok: false, error: cleanupError }, { status: 500 });
  }

  return Response.json({ ok: true }, { headers: rateLimitHeaders(rateLimit) });
}
