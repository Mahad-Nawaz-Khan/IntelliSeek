export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt", ".md"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const ALLOWED_MIME_TYPES: Record<AllowedExtension, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
export const BUCKET_NAME = "academic-documents";

export function getStorageUploadErrorMessage(message: string) {
  return message.toLowerCase().includes("bucket not found")
    ? `Storage bucket "${BUCKET_NAME}" was not found. Create it in Supabase Storage or run database/schema.sql for the current Supabase project.`
    : message;
}

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.slice(dot).toLowerCase();
}

// Browsers report these when they cannot identify a file, which is common for
// `.docx`/`.pptx` on machines without Office installed. An unknown type is not
// a wrong type: the canonical MIME is what gets stored and re-validated
// server-side, so this check only rejects a confidently mismatched report.
const UNKNOWN_MIME_TYPES = new Set(["", "application/octet-stream"]);
const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown"]);

function reportsConflictingMime(extension: AllowedExtension, reportedMime: string) {
  const reported = reportedMime.trim().toLowerCase();
  if (UNKNOWN_MIME_TYPES.has(reported)) return false;
  if (extension === ".txt" || extension === ".md") return !TEXT_MIME_TYPES.has(reported);
  return reported !== ALLOWED_MIME_TYPES[extension];
}

export function isAllowedFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as AllowedExtension)) {
    return { valid: false, error: `Unsupported file type: ${ext || "none"}` };
  }

  if (reportsConflictingMime(ext as AllowedExtension, file.type)) {
    return {
      valid: false,
      error: `"${file.type}" does not match the ${ext} extension`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 20 MB.`,
    };
  }
  return { valid: true };
}
