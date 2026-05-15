export const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"] as const;
export type AllowedExtension = (typeof ALLOWED_EXTENSIONS)[number];

export const ALLOWED_MIME_TYPES: Record<AllowedExtension, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const BUCKET_NAME = "academic-documents";

export function getAllowedMimeSet(): Set<string> {
  return new Set(Object.values(ALLOWED_MIME_TYPES));
}

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return "";
  return filename.slice(dot).toLowerCase();
}

export function isAllowedFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const ext = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as AllowedExtension)) {
    return { valid: false, error: `Unsupported file type: ${ext || "none"}` };
  }

  const expectedMime = ALLOWED_MIME_TYPES[ext as AllowedExtension];
  if (!file.type || file.type !== expectedMime) {
    return {
      valid: false,
      error: `File MIME type does not match ${ext}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`,
    };
  }
  return { valid: true };
}
