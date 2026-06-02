import { ALLOWED_MIME_TYPES, BUCKET_NAME, getExtension, MAX_FILE_SIZE, type AllowedExtension } from "../../../lib/upload-config";
import JSZip from "jszip";

import { getAuthenticatedUser } from "../../../lib/server/auth";
import { inngest } from "../../../lib/server/inngest/client";
import { createRequestLogger, type LogData, type RequestLogger } from "../../../lib/server/logger";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../lib/server/rate-limit";
import { isAdminUser } from "../../../lib/server/roles";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";

export const runtime = "nodejs";

type ParseRequestBody = {
  storage_path?: unknown;
  filename?: unknown;
  file_type?: unknown;
  file_size?: unknown;
  source_scope?: unknown;
};

type StorageObjectInfo = {
  name?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
    contentType?: string;
  } | null;
};

function failure(status: number, error: string, log?: RequestLogger, data: LogData = {}) {
  log?.warn("request.failed", { errorCategory: "unknown", status, error, ...data });
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

function splitStoragePath(storagePath: string) {
  const normalizedPath = storagePath.replace(/\\/g, "/");
  const slashIndex = normalizedPath.lastIndexOf("/");
  if (slashIndex === -1) return null;

  return {
    folder: normalizedPath.slice(0, slashIndex),
    name: normalizedPath.slice(slashIndex + 1),
  };
}

function hasPdfSignature(bytes: Uint8Array) {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function hasZipSignature(bytes: Uint8Array) {
  return bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function isPlainText(bytes: Uint8Array) {
  if (!bytes.length) return false;
  if (bytes.includes(0)) return false;

  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

async function validateOfficeContainer(bytes: Uint8Array, extension: AllowedExtension) {
  if (!hasZipSignature(bytes)) return false;

  try {
    const zip = await JSZip.loadAsync(bytes);
    if (extension === ".docx") return Boolean(zip.file("word/document.xml"));
    if (extension === ".pptx") return Boolean(zip.file("ppt/presentation.xml"));
    return false;
  } catch {
    return false;
  }
}

async function validateFileContent(bytes: Uint8Array, extension: AllowedExtension) {
  if (extension === ".pdf") return hasPdfSignature(bytes);
  if (extension === ".txt" || extension === ".md") return isPlainText(bytes);
  return validateOfficeContainer(bytes, extension);
}

async function validateStoredObject(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  storagePath: string,
  extension: AllowedExtension,
  expectedSize: number,
  expectedMime: string,
  log?: RequestLogger,
) {
  const pathParts = splitStoragePath(storagePath);
  if (!pathParts) {
    log?.warn("storage.verify.invalid_path", { errorCategory: "validation" });
    return "Malformed storage path";
  }

  log?.info("storage.verify.start", { extension, expectedSize, expectedMime });
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(pathParts.folder, { limit: 100, search: pathParts.name });

  if (error) {
    log?.error("storage.verify.failed", { errorCategory: "storage_download", error });
    return "Uploaded file could not be verified";
  }

  const object = ((data ?? []) as StorageObjectInfo[]).find((item) => item.name === pathParts.name);
  if (!object) {
    log?.warn("storage.verify.not_found", { errorCategory: "storage_download" });
    return "Uploaded file was not found in storage";
  }

  const storedSize = object.metadata?.size;
  if (typeof storedSize === "number" && storedSize !== expectedSize) {
    log?.warn("storage.verify.size_mismatch", { errorCategory: "validation", expectedSize, storedSize });
    return "Uploaded file size does not match storage metadata";
  }

  const storedMime = object.metadata?.mimetype ?? object.metadata?.contentType;
  if (typeof storedMime === "string" && storedMime !== expectedMime) {
    log?.warn("storage.verify.mime_mismatch", { errorCategory: "validation", expectedMime, storedMime });
    return "Uploaded file MIME type does not match storage metadata";
  }

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (downloadError || !fileData) {
    log?.error("storage.download.failed", { errorCategory: "storage_download", error: downloadError });
    return "Uploaded file could not be inspected";
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());
  if (bytes.byteLength !== expectedSize) {
    log?.warn("storage.verify.inspected_size_mismatch", { errorCategory: "validation", expectedSize, inspectedSize: bytes.byteLength });
    return "Uploaded file size does not match inspected content";
  }

  const hasExpectedContent = await validateFileContent(bytes, extension);
  if (!hasExpectedContent) {
    log?.warn("storage.verify.content_mismatch", { errorCategory: "validation", extension });
    return "Uploaded file content does not match its extension";
  }

  log?.info("storage.verify.complete", { inspectedSize: bytes.byteLength });
  return null;
}

export async function POST(request: Request) {
  const log = createRequestLogger("api.parse");
  let body: ParseRequestBody;

  try {
    body = (await request.json()) as ParseRequestBody;
  } catch (error) {
    return failure(400, "Invalid JSON request body", log, { errorCategory: "validation", error });
  }

  log.info("request.start", {
    filenamePresent: typeof body.filename === "string",
    fileType: typeof body.file_type === "string" ? body.file_type : undefined,
    fileSize: typeof body.file_size === "number" ? body.file_size : undefined,
  });

  const validationError = validateBody(body);
  if (validationError) return failure(400, validationError, log, { errorCategory: "validation" });

  const supabase = getSupabaseServiceClient();
  if (!supabase) return failure(500, "Supabase service client is not configured", log, { errorCategory: "supabase_query" });

  const user = await getAuthenticatedUser(log);
  if (!user) return failure(401, "Sign in is required", log, { errorCategory: "auth_failure" });

  const rateLimit = await checkRateLimit({
    key: `parse:${user.id}:${getClientIp(request)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    log.warn("rate_limit.exceeded", { errorCategory: "rate_limit", userId: user.id });
    return rateLimitResponse(rateLimit);
  }

  const storagePath = (body.storage_path as string).replace(/\\/g, "/");
  const filename = body.filename as string;
  const fileType = body.file_type as string;
  const fileSize = body.file_size as number;
  const sourceScope = body.source_scope === "knowledge_base" ? "knowledge_base" : "personal";
  const extension = getExtension(filename) as AllowedExtension;

  if (sourceScope === "knowledge_base" && !isAdminUser(user)) {
    return failure(403, "Only admins can upload to the knowledge base", log, { errorCategory: "auth_failure", userId: user.id });
  }

  if (!storagePath.startsWith(`${user.id}/`)) {
    return failure(403, "Storage path does not belong to the signed-in user", log, { errorCategory: "auth_failure", userId: user.id });
  }

  const storedObjectError = await validateStoredObject(supabase, storagePath, extension, fileSize, fileType, log);
  if (storedObjectError) return failure(400, storedObjectError, log, { errorCategory: "storage_download", userId: user.id });

  const { data: documentRows, error: documentError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      filename,
      file_type: fileType,
      file_size: fileSize,
      storage_path: storagePath,
      processing_status: "queued",
      source_scope: sourceScope,
    })
    .select("id")
    .single();

  if (documentError || !documentRows?.id) {
    log.error("document.insert.failed", { errorCategory: "supabase_insert", userId: user.id, error: documentError });
    return failure(500, "Document metadata persistence failed", log, { errorCategory: "supabase_insert", userId: user.id });
  }

  log.info("document.insert.complete", { userId: user.id, documentId: documentRows.id });

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
        sourceScope,
      },
    });
    log.info("inngest.enqueue.complete", { userId: user.id, documentId: documentRows.id });
  } catch (error) {
    log.error("inngest.enqueue.failed", { errorCategory: "inngest_enqueue", userId: user.id, documentId: documentRows.id, error });
    await supabase
      .from("documents")
      .update({
        processing_status: "failed",
        processing_error: "Indexing job could not be queued",
      })
      .eq("id", documentRows.id)
      .eq("user_id", user.id);
    return failure(500, "Indexing job could not be queued", log, { errorCategory: "inngest_enqueue", userId: user.id, documentId: documentRows.id });
  }

  log.info("request.complete", { userId: user.id, documentId: documentRows.id, status: 202 });

  return Response.json(
    {
      ok: true,
      status: "Document queued for indexing",
      document_id: documentRows.id,
      filename,
      processing_status: "queued",
    },
    { status: 202, headers: rateLimitHeaders(rateLimit) },
  );
}
