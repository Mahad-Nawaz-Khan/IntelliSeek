"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../context/AuthContext";
import { deleteChatSession, fetchChatSessions, type ChatSessionSummary } from "../../lib/chat-api";
import {
  createSourceGroups,
  getFileType,
  type KnowledgeSource,
} from "../../lib/ui-state";
import { AcademicWorkspace } from "../chat/AcademicWorkspace";
import { IndexingToast, type UploadIndexingToast } from "../upload/IndexingToast";
import { UploadModal } from "../upload/UploadModal";

type SupabaseKnowledgeSource = {
  id: string;
  filename: string;
  created_at?: string;
  processing_status?: "uploaded" | "queued" | "processing" | "indexed" | "failed";
  processing_error?: string | null;
};

type DocumentsResponse = {
  ok: boolean;
  documents?: SupabaseKnowledgeSource[];
};

type WorkspaceShellProps = {
  children: ReactNode;
};

function toUploadedSource(source: SupabaseKnowledgeSource): KnowledgeSource {
  const status = source.processing_status === "queued" || source.processing_status === "processing" || source.processing_status === "uploaded"
    ? "indexing"
    : source.processing_status === "failed"
      ? "failed"
      : "indexed";

  return {
    id: source.id,
    filename: source.filename,
    sourceType: "uploaded",
    fileType: getFileType(source.filename),
    status,
    createdAt: source.created_at,
    summary: source.processing_error ?? undefined,
  };
}

export function WorkspaceShell({ children }: WorkspaceShellProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useAuth();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">("loading");
  const [recentSessionRows, setRecentSessionRows] = useState<ChatSessionSummary[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [uploadToasts, setUploadToasts] = useState<UploadIndexingToast[]>([]);
  const didLoadSidebarRef = useRef(false);

  const sourceGroups = useMemo(() => createSourceGroups(sources), [sources]);
  const recentChats = useMemo(() => recentSessionRows.map((session) => ({
    id: session.id,
    title: session.title || "New chat",
    lastMessageAt: session.updated_at
      ? new Date(session.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : undefined,
    status: "inactive" as const,
  })), [recentSessionRows]);
  const completedDocumentIds = useMemo(
    () => new Set(sources.filter((source) => source.status === "indexed").map((source) => source.id)),
    [sources],
  );
  const failedDocuments = useMemo(
    () => new Map(sources.filter((source) => source.status === "failed").map((source) => [source.id, source.summary ?? "Indexing failed"])),
    [sources],
  );

  const refreshRecentChats = useCallback(async () => {
    try {
      setRecentSessionRows(await fetchChatSessions());
    } catch {
      setRecentSessionRows([]);
    }
  }, []);

  const refreshSources = useCallback(async () => {
    try {
      const response = await fetch("/api/documents");
      const result = (await response.json()) as DocumentsResponse;

      if (!response.ok || !result.ok) {
        setSourceStatus("unavailable");
        return;
      }

      const rows = (result.documents ?? []).map(toUploadedSource);
      setSources(rows);
      setSourceStatus(rows.length ? "ready" : "empty");
    } catch {
      setSourceStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    if (isLoaded && (!isSignedIn || !user)) {
      router.replace("/sign-in?next=/chat");
      return;
    }

    if (didLoadSidebarRef.current) return;
    didLoadSidebarRef.current = true;

    void refreshSources();
    void refreshRecentChats();
  }, [isLoaded, isSignedIn, refreshRecentChats, refreshSources, router, user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUploadToasts((current) =>
      current.map((toast) => {
        if (toast.status !== "uploading" && toast.status !== "indexing") return toast;

        if (toast.documentId && completedDocumentIds.has(toast.documentId)) {
          return { ...toast, status: "completed" as const };
        }

        const failure = toast.documentId ? failedDocuments.get(toast.documentId) : undefined;
        if (failure) return { ...toast, status: "failed" as const, errorMessage: failure };

        return toast;
      }),
    );
  }, [completedDocumentIds, failedDocuments]);

  useEffect(() => {
    const hasIndexing = sources.some((source) => source.status === "indexing");
    if (!hasIndexing) return;

    const interval = window.setInterval(() => void refreshSources(), 3000);
    return () => window.clearInterval(interval);
  }, [refreshSources, sources]);

  useEffect(() => {
    const completedIds = uploadToasts
      .filter((toast) => toast.status === "completed")
      .map((toast) => toast.toastId);
    if (!completedIds.length) return;

    const timeout = window.setTimeout(() => {
      setUploadToasts((current) => current.filter((toast) => !completedIds.includes(toast.toastId)));
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [uploadToasts]);

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    if (deletingSourceId) return;

    setDeletingSourceId(sourceId);
    try {
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: sourceId }),
      });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !result?.ok) throw new Error(result?.error ?? "Document deletion failed");

      setSources((current) => current.filter((source) => source.id !== sourceId));
    } catch {
      setSourceStatus("unavailable");
    } finally {
      setDeletingSourceId(null);
    }
  }, [deletingSourceId]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (deletingSessionId) return;

    setDeletingSessionId(sessionId);
    try {
      await deleteChatSession(sessionId);
      setRecentSessionRows((current) => current.filter((session) => session.id !== sessionId));
      await refreshRecentChats();
    } catch {
    } finally {
      setDeletingSessionId(null);
    }
  }, [deletingSessionId, refreshRecentChats]);

  if (isLoaded && (!isSignedIn || !user)) return null;

  return (
    <AcademicWorkspace
      groups={sourceGroups}
      recentChats={recentChats}
      sourceStatus={sourceStatus}
      deletingSourceId={deletingSourceId}
      deletingSessionId={deletingSessionId}
      onDeleteSource={handleDeleteSource}
      onDeleteSession={handleDeleteSession}
      onOpenSession={(sessionId) => router.push(`/chat?session=${encodeURIComponent(sessionId)}`)}
      onNewChat={() => router.push("/chat")}
      onOpenUpload={() => setIsUploadOpen(true)}
    >
      {children}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadToast={(toast) => {
          if (toast.documentId) void refreshSources();
          setUploadToasts((current) => {
            const existing = current.find((item) => item.toastId === toast.toastId);
            return [
              ...current.filter((item) => item.toastId !== toast.toastId),
              {
                toastId: toast.toastId,
                documentId: toast.documentId ?? existing?.documentId,
                filename: toast.filename,
                queuedAt: toast.queuedAt ?? existing?.queuedAt ?? Date.now(),
                status: toast.status,
                errorMessage: toast.errorMessage,
              },
            ];
          });
        }}
        completedDocumentIds={completedDocumentIds}
        failedDocuments={failedDocuments}
      />
      <IndexingToast toasts={uploadToasts} onDismiss={(toastId) => setUploadToasts((current) => current.filter((toast) => toast.toastId !== toastId))} />
    </AcademicWorkspace>
  );
}
