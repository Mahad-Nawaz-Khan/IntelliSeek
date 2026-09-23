"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "../../context/AuthContext";
import { deleteChatSession, fetchChatSessions, renameChatSession, type ChatSessionSummary } from "../../lib/chat-api";
import { fetchAccessibleDocuments, fetchMyRole } from "../../lib/documents";
import { createSourceGroups, type KnowledgeSource } from "../../lib/ui-state";
import { AcademicWorkspace } from "../chat/AcademicWorkspace";
import { IndexingToast, type UploadIndexingToast } from "../upload/IndexingToast";
import { UploadModal } from "../upload/UploadModal";

type WorkspaceShellProps = {
  children: ReactNode;
};

export function WorkspaceShell({ children }: Readonly<WorkspaceShellProps>) {
  const router = useRouter();
  const { isLoaded, isSignedIn, user } = useAuth();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">("loading");
  const [recentSessionRows, setRecentSessionRows] = useState<ChatSessionSummary[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<"personal" | "knowledge_base">("personal");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [uploadToasts, setUploadToasts] = useState<UploadIndexingToast[]>([]);
  const didLoadSidebarRef = useRef(false);

  const sourceGroups = useMemo(() => createSourceGroups(sources), [sources]);
  const recentChats = useMemo(() => recentSessionRows.map((session) => ({
    id: session.id,
    title: session.title || "New chat",
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

  const refreshSources = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    try {
      const rows = await fetchAccessibleDocuments({ force });
      setSources(rows);
      setSourceStatus(rows.length ? "ready" : "empty");
    } catch {
      setSourceStatus("unavailable");
    }
  }, []);

  const refreshRole = useCallback(async () => {
    try {
      setIsAdmin((await fetchMyRole()) === "admin");
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && (!isSignedIn || !user)) {
      router.replace("/sign-in?next=/chat");
      return;
    }

    if (didLoadSidebarRef.current) return;
    didLoadSidebarRef.current = true;

    refreshSources().catch(() => {});
    refreshRecentChats().catch(() => {});
    refreshRole().catch(() => {});
  }, [isLoaded, isSignedIn, refreshRecentChats, refreshRole, refreshSources, router, user]);

  useEffect(() => {
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

    const interval = window.setInterval(() => {
      refreshSources().catch(() => {});
    }, 3000);
    return () => window.clearInterval(interval);
  }, [refreshSources, sources]);

  useEffect(() => {
    const completedIds = uploadToasts
      .filter((toast) => toast.status === "completed")
      .map((toast) => toast.toastId);
    if (!completedIds.length) return;

    const filterCompleted = (current: UploadIndexingToast[]) =>
      current.filter((toast) => !completedIds.includes(toast.toastId));

    const timeout = window.setTimeout(() => {
      setUploadToasts(filterCompleted);
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

  const handleRenameSession = useCallback(async (sessionId: string, title: string) => {
    try {
      const updated = await renameChatSession(sessionId, title);
      setRecentSessionRows((current) =>
        current.map((session) => (session.id === sessionId ? { ...session, title: updated.title } : session)),
      );
      return true;
    } catch {
      return false;
    }
  }, []);

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
      onRenameSession={handleRenameSession}
      onOpenSession={(sessionId) => router.push(`/chat?session=${encodeURIComponent(sessionId)}`)}
      onNewChat={() => router.push("/chat")}
      onOpenUpload={() => {
        setUploadTarget("personal");
        setIsUploadOpen(true);
      }}
      onOpenKnowledgeBaseUpload={isAdmin ? () => {
        setUploadTarget("knowledge_base");
        setIsUploadOpen(true);
      } : undefined}
      canManageKnowledgeBase={isAdmin}
    >
      {children}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setUploadTarget("personal");
        }}
        uploadTarget={uploadTarget}
        onUploadToast={(toast) => {
          if (toast.documentId) {
            refreshSources({ force: true }).catch(() => {});
          }
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
