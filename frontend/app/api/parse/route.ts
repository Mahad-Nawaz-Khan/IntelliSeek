import { ALLOWED_MIME_TYPES, BUCKET_NAME, getExtension, getStorageUploadErrorMessage, MAX_FILE_SIZE, type AllowedExtension } from "../../../lib/upload-config";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { chunkText } from "../../../lib/server/rag/chunker";
import { EMBEDDING_DIMENSION, embedTexts } from "../../../lib/server/rag/embeddings";
import { extractTextFromBuffer } from "../../../lib/server/rag/parser";
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

function toVectorLiteral(embedding: number[]) {
  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(`Embedding dimension mismatch. Expected ${EMBEDDING_DIMENSION}, received ${embedding.length}.`);
  }
  return `[${embedding.join(",")}]`;
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

  const { data: fileData, error: downloadError } = await supabase.storage
    .from(BUCKET_NAME)
    .download(storagePath);

  if (downloadError || !fileData) {
    return failure(404, downloadError ? getStorageUploadErrorMessage(downloadError.message) : "Stored file not found");
  }

  let extracted: string;
  try {
    extracted = await extractTextFromBuffer(await fileData.arrayBuffer(), filename, fileType);
  } catch (error) {
    return failure(400, error instanceof Error ? error.message : "Could not parse file");
  }

  const chunks = chunkText(extracted);
  if (!chunks.length) return failure(400, "Extracted text has no indexable content");

  const { data: documentRows, error: documentError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      filename,
      file_type: fileType,
      file_size: fileSize,
      storage_path: storagePath,
    })
    .select("id")
    .single();

  if (documentError || !documentRows?.id) return failure(500, "Document metadata persistence failed");

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(chunks);
  } catch (error) {
    return failure(500, error instanceof Error ? error.message : "Embedding generation failed");
  }
  let chunkRows: Array<{
    document_id: string;
    text_content: string;
    chunk_index: number;
    embedding: string;
  }>;
  try {
    chunkRows = chunks.map((chunk, index) => ({
      document_id: documentRows.id,
      text_content: chunk,
      chunk_index: index,
      embedding: toVectorLiteral(embeddings[index]),
    }));
  } catch (error) {
    return failure(500, error instanceof Error ? error.message : "Embedding formatting failed");
  }

  const { data: insertedChunks, error: chunkError } = await supabase
    .from("chunks")
    .insert(chunkRows)
    .select("id");

  if (chunkError) return failure(500, "Chunk persistence failed");

  return Response.json({
    ok: true,
    status: "Document parsed and indexed successfully",
    document_id: documentRows.id,
    filename,
    text_preview: extracted.slice(0, 100),
    chunks_created: chunks.length,
    vectors_indexed: insertedChunks?.length ?? chunks.length,
    index_total: insertedChunks?.length ?? chunks.length,
  });
}
