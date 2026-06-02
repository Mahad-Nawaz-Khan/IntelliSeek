import { readParseResponse } from "./parse-response";
import { supabase } from "./supabase";
import {
  ALLOWED_MIME_TYPES,
  BUCKET_NAME,
  getExtension,
  getStorageUploadErrorMessage,
  isAllowedFile,
  type AllowedExtension,
} from "./upload-config";
import type { UploadItem } from "./ui-state";

export type UploadToastPayload = {
  toastId: string;
  documentId?: string;
  filename: string;
  status: "uploading" | "indexing" | "failed";
  queuedAt?: number;
  errorMessage?: string;
};

type UploadDocumentOptions = {
  file: File;
  userId?: string;
  isAuthLoaded: boolean;
  isSignedIn: boolean;
  uploadTarget?: "personal" | "knowledge_base";
  toastValidationFailures?: boolean;
  onToast?: (payload: UploadToastPayload) => void;
  onProgress?: (item: UploadItem, documentId?: string) => void;
  onUploadStarted?: () => void;
};

export function toSizeLabel(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function toFileType(filename: string): UploadItem["fileType"] {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "pdf" || extension === "docx" || extension === "pptx" || extension === "txt" || extension === "md") return extension;
  return "unknown";
}

function createBaseItem(file: File): UploadItem {
  return {
    id: `${Date.now()}-${file.name}`,
    filename: file.name,
    fileType: toFileType(file.name),
    sizeLabel: toSizeLabel(file.size),
    progress: 0,
    status: "idle",
  };
}

function safeUploadName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function uploadDocumentFile({
  file,
  userId,
  isAuthLoaded,
  isSignedIn,
  uploadTarget = "personal",
  toastValidationFailures = false,
  onToast,
  onProgress,
  onUploadStarted,
}: UploadDocumentOptions) {
  const baseItem = createBaseItem(file);
  const timestamp = Date.now();
  const safeName = safeUploadName(file.name);
  const toastId = `${timestamp}-${safeName}`;

  function fail(errorMessage: string) {
    onProgress?.({ ...baseItem, status: "failed", errorMessage });
    if (toastValidationFailures) onToast?.({ toastId, filename: file.name, status: "failed", errorMessage });
    return { ok: false as const, error: errorMessage };
  }

  const check = isAllowedFile(file);
  if (!check.valid) return fail(check.error ?? "Invalid file");
  if (!isAuthLoaded) return fail("Authentication is still loading");
  if (!isSignedIn || !userId) return fail("Sign in before uploading notes");
  if (!supabase) return fail("Supabase client is not configured");

  const storagePath = `${userId}/${timestamp}-${safeName}`;
  const ext = getExtension(file.name) as AllowedExtension;
  const contentType = ALLOWED_MIME_TYPES[ext];

  onToast?.({ toastId, filename: file.name, status: "uploading", queuedAt: timestamp });
  onUploadStarted?.();
  onProgress?.({ ...baseItem, progress: 35, status: "uploading" });

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, { upsert: false, contentType });

  if (uploadError) {
    const errorMessage = getStorageUploadErrorMessage(uploadError.message);
    onProgress?.({ ...baseItem, status: "failed", errorMessage });
    onToast?.({ toastId, filename: file.name, status: "failed", errorMessage });
    return { ok: false as const, error: errorMessage };
  }

  onProgress?.({ ...baseItem, progress: 78, status: "indexing" });
  onToast?.({ toastId, filename: file.name, status: "indexing" });

  try {
    const response = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage_path: storagePath,
        filename: file.name,
        file_type: contentType,
        file_size: file.size,
        source_scope: uploadTarget,
      }),
    });
    const result = await readParseResponse(response);

    if (!result.ok) {
      const errorMessage = result.error ?? "Parsing failed";
      onProgress?.({ ...baseItem, status: "failed", errorMessage });
      onToast?.({ toastId, filename: file.name, status: "failed", errorMessage });
      return { ok: false as const, error: errorMessage };
    }

    if (!result.document_id) {
      const errorMessage = "Queued document did not return an id";
      onProgress?.({ ...baseItem, status: "failed", errorMessage });
      onToast?.({ toastId, filename: file.name, status: "failed", errorMessage });
      return { ok: false as const, error: errorMessage };
    }

    onProgress?.({ ...baseItem, progress: 88, status: "indexing" }, result.document_id);
    onToast?.({ toastId, documentId: result.document_id, filename: file.name, status: "indexing" });
    return { ok: true as const, documentId: result.document_id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Could not reach the parsing service";
    onProgress?.({ ...baseItem, status: "failed", errorMessage });
    onToast?.({ toastId, filename: file.name, status: "failed", errorMessage });
    return { ok: false as const, error: errorMessage };
  }
}
