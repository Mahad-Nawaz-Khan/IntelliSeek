import { ALLOWED_MIME_TYPES, getExtension, MAX_FILE_SIZE, type AllowedExtension } from "../../../lib/upload-config";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { inngest } from "../../../lib/server/inngest/client";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

type ParseRequestBody = {
  storage_path?: unknown;
  filename?: unknown;
  file_type?: unknown;
  file_size?: unknown;
};

function failure(status: number, error: string) {
  return Response.json(
    { ok: false, status: "Document parsing failed", error },
    { status },
  );
}

function validateBody(body: ParseRequestBody) {
  if (typeof body.storage_path !== "string" || !body.storage_path.trim()) {
    return "Missing storage path";
  }
  if (typeof body.filename !== "string" || !body.filename.trim()) {
    return "Missing filename";
  }
  if (typeof body.file_type !== "string" || !body.file_type.trim()) {
    return "Missing MIME type";
  }
  if (typeof body.file_size !== "number" || body.file_size <= 0 || body.file_size > MAX_FILE_SIZE) {
    return `Invalid file size: ${String(body.file_size)}`;
  }

  const normalizedPath = body.storage_path.replace(/\\/g, "/");
  if (normalizedPath.startsWith("/") || normalizedPath.split("/").includes("..")) {
    return "Malformed storage path";
  }

  const extension = getExtension(body.filename) as AllowedExtension;
  if (!(extension in ALLOWED_MIME_TYPES)) {
    return `Unsupported file type: ${extension || "none"}`;
  }
  if (body.file_type !== ALLOWED_MIME_TYPES[extension]) {
    return "File extension and MIME type do not match";
  }
  if (!normalizedPath.endsWith(body.filename.replace(/[^a-zA-Z0-9._-]/g, "_"))) {
    return "Filename does not match storage path";
  }

  return null;
}

export async function POST(request: Request) {
  let body: ParseRequestBody;

  try {
    body = (await request.json()) as ParseRequestBody;
  } catch {
    return failure(400, "Invalid JSON request body");
  }

  const validationError = validateBody(body);
  if (validationError) return failure(400, validationError);

  const supabase = getSupabaseServiceClient();
  if (!supabase) return failure(500, "Supabase service client is not configured");

  const user = await getAuthenticatedUser();
  if (!user) return failure(401, "Sign in is required");

  const storagePath = (body.storage_path as string).replace(/\\/g, "/");
  const filename = body.filename as string;
  const fileType = body.file_type as string;
  const fileSize = body.file_size as number;

  if (!storagePath.startsWith(`${user.id}/`)) {
    return failure(403, "Storage path does not belong to the signed-in user");
  }

  const { data: documentRows, error: documentError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      filename,
      file_type: fileType,
      file_size: fileSize,
      storage_path: storagePath,
      processing_status: "queued",
    })
    .select("id")
    .single();

  if (documentError || !documentRows?.id) return failure(500, "Document metadata persistence failed");

  try {
    await inngest.send({
      id: `document-index-${documentRows.id}`,
      name: "document/index.requested",
      data: {
        userId: user.id,
        documentId: documentRows.id,
        storagePath,
        filename,
        fileType,
      },
    });
  } catch {
    await supabase
      .from("documents")
      .update({
        processing_status: "failed",
        processing_error: "Indexing job could not be queued",
      })
      .eq("id", documentRows.id)
      .eq("user_id", user.id);
    return failure(500, "Indexing job could not be queued");
  }

  return Response.json(
    {
      ok: true,
      status: "Document queued for indexing",
      document_id: documentRows.id,
      filename,
      processing_status: "queued",
    },
    { status: 202 },
  );
}
