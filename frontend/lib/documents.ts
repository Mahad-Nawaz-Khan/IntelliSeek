import { getFileType, type KnowledgeSource } from "./ui-state";

export type DocumentRow = {
  id: string;
  filename: string;
  created_at?: string;
  processing_status?: "uploaded" | "queued" | "processing" | "indexed" | "failed";
  processing_error?: string | null;
  source_scope?: "personal" | "knowledge_base";
};

export type UserRole = "admin" | "user";

type DocumentsResponse = {
  ok: boolean;
  documents?: DocumentRow[];
};

type MeResponse = {
  ok: boolean;
  user?: { role?: UserRole };
};

function resolveKnowledgeSourceStatus(processingStatus?: DocumentRow["processing_status"]): "indexing" | "failed" | "indexed" {
  if (processingStatus === "queued" || processingStatus === "processing" || processingStatus === "uploaded") {
    return "indexing";
  }
  if (processingStatus === "failed") {
    return "failed";
  }
  return "indexed";
}

export function toKnowledgeSource(row: DocumentRow): KnowledgeSource {
  const status = resolveKnowledgeSourceStatus(row.processing_status);

  return {
    id: row.id,
    filename: row.filename,
    sourceType: row.source_scope === "knowledge_base" ? "knowledge-base" : "uploaded",
    fileType: getFileType(row.filename),
    status,
    createdAt: row.created_at,
    summary: row.processing_error ?? undefined,
  };
}

// The workspace shell and the chat page both load documents on mount and poll
// while indexing runs, so the same list was being requested twice per interval.
// Calls inside this window share one request; `force` bypasses it after
// mutations, where a cached pre-upload list would hide the new document.
const DEDUPE_WINDOW_MS = 2500;

let documentsCache: { at: number; promise: Promise<KnowledgeSource[]> } | null = null;
let roleCache: { at: number; promise: Promise<UserRole | null> } | null = null;

async function requestDocuments(): Promise<KnowledgeSource[]> {
  const response = await fetch("/api/documents");
  const result = (await response.json()) as DocumentsResponse;
  if (!response.ok || !result.ok) throw new Error("Document lookup failed");
  return (result.documents ?? []).map(toKnowledgeSource);
}

export async function fetchAccessibleDocuments({ force = false } = {}): Promise<KnowledgeSource[]> {
  const now = Date.now();
  if (!force && documentsCache && now - documentsCache.at < DEDUPE_WINDOW_MS) {
    return documentsCache.promise;
  }

  const promise = requestDocuments();
  documentsCache = { at: now, promise };
  // A failed request must not be served to later callers for the rest of the
  // window; each current caller still sees the original rejection.
  void promise.catch(() => {
    if (documentsCache?.promise === promise) documentsCache = null;
  });
  return promise;
}

async function requestMyRole(): Promise<"admin" | "user" | null> {
  const response = await fetch("/api/me");
  const result = (await response.json()) as MeResponse;
  if (!response.ok || !result.ok) return null;
  return result.user?.role ?? "user";
}

export async function fetchMyRole(): Promise<"admin" | "user" | null> {
  const now = Date.now();
  if (roleCache && now - roleCache.at < DEDUPE_WINDOW_MS) {
    return roleCache.promise;
  }

  const promise = requestMyRole();
  roleCache = { at: now, promise };
  void promise.catch(() => {
    if (roleCache?.promise === promise) roleCache = null;
  });
  return promise;
}
