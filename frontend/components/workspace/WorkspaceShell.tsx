"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "../../context/AuthContext";
import {
  deleteChatSession,
  fetchChatSessions,
  renameChatSession,
  type ChatSessionSummary,
} from "../../lib/chat-api";
import {
  deleteDocumentById,
  fetchAccessibleDocuments,
  fetchMyRole,
  invalidateDocumentsCache,
} from "../../lib/documents";
import { usePreferences } from "../../lib/preferences";
import { createSourceGroups, type KnowledgeSource } from "../../lib/ui-state";
import type { UploadToastPayload } from "../../lib/upload-document";
import { AcademicWorkspace } from "../chat/AcademicWorkspace";
import { IndexingToast, type UploadIndexingToast } from "../upload/IndexingToast";
import { UploadModal } from "../upload/UploadModal";

export type FocusedDocument = {
  id: string;
  filename: string;
};

type SessionLifecycleHandlers = {
  onSessionDeleted?: (sessionId: string) => void;
  onNewChat?: () => void;
  onToggleTemporaryChat?: () => void;
};

export type WorkspaceContextValue = {
  sources: KnowledgeSource[];
  setSources: Dispatch<SetStateAction<KnowledgeSource[]>>;
  sourceStatus: "loading" | "ready" | "empty" | "unavailable";
  setSourceStatus: Dispatch<SetStateAction<"loading" | "ready" | "empty" | "unavailable">>;
  refreshSources: (options?: { force?: boolean }) => Promise<void>;
  handleDeleteSource: (sourceId: string) => Promise<void>;
  deletingSourceId: string | null;
  recentSessionRows: ChatSessionSummary[];
  setRecentSessionRows: Dispatch<SetStateAction<ChatSessionSummary[]>>;
  activeSessionId: string | null;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  isTemporaryChat: boolean;
  setIsTemporaryChat: Dispatch<SetStateAction<boolean>>;
  refreshRecentChats: () => Promise<void>;
  handleDeleteSession: (sessionId: string) => Promise<void>;
  handleRenameSession: (sessionId: string, title: string) => Promise<boolean>;
  deletingSessionId: string | null;
  isAdmin: boolean;
  includeKnowledgeBase: boolean;
  toggleKnowledgeBase: () => void;
  focusedDocument: FocusedDocument | null;
  setFocusedDocument: Dispatch<SetStateAction<FocusedDocument | null>>;
  focusDocumentInChat: (doc: FocusedDocument) => void;
  openUploadModal: (target?: "personal" | "knowledge_base") => void;
  handleUploadToast: (toast: UploadToastPayload) => void;
  registerSessionLifecycle: (handlers: SessionLifecycleHandlers) => () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceOptional() {
  return useContext(WorkspaceContext);
}

type WorkspaceShellProps = {
  children: ReactNode;
};

export function WorkspaceShell({ children }: Readonly<WorkspaceShellProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn, user } = useAuth();
  const { preferences, updatePreference } = usePreferences();
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">("loading");
  const [recentSessionRows, setRecentSessionRows] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isTemporaryChat, setIsTemporaryChat] = useState(false);
  const [focusedDocument, setFocusedDocument] = useState<FocusedDocument | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<"personal" | "knowledge_base">("personal");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [uploadToasts, setUploadToasts] = useState<UploadIndexingToast[]>([]);

  const didLoadSidebarRef = useRef(false);
  const inFlightSourceDeletesRef = useRef<Set<string>>(new Set());
  const inFlightSessionDeletesRef = useRef<Set<string>>(new Set());
  const lifecycleHandlersRef = useRef<Set<SessionLifecycleHandlers>>(new Set());

  const registerSessionLifecycle = useCallback((handlers: SessionLifecycleHandlers) => {
    lifecycleHandlersRef.current.add(handlers);
    return () => {
      lifecycleHandlersRef.current.delete(handlers);
    };
  }, []);

  const sourceGroups = useMemo(() => createSourceGroups(sources), [sources]);
  const recentChats = useMemo(
    () =>
      recentSessionRows.map((session) => ({
        id: session.id,
        title: session.title || "New chat",
        status: session.id === activeSessionId ? ("active" as const) : ("inactive" as const),
      })),
    [activeSessionId, recentSessionRows],
  );
  const completedDocumentIds = useMemo(
    () => new Set(sources.filter((source) => source.status === "indexed").map((source) => source.id)),
    [sources],
  );
  const failedDocuments = useMemo(
    () =>
      new Map(
        sources
          .filter((source) => source.status === "failed")
          .map((source) => [source.id, source.summary ?? "Indexing failed"]),
      ),
    [sources],
  );

  const refreshRecentChats = useCallback(async () => {
    try {
      const sessions = await fetchChatSessions();
      setRecentSessionRows(sessions.filter((s) => !inFlightSessionDeletesRef.current.has(s.id)));
    } catch {
      setRecentSessionRows([]);
    }
  }, []);

  const refreshSources = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    try {
      const rows = await fetchAccessibleDocuments({ force });
      const filteredRows = rows.filter((row) => !inFlightSourceDeletesRef.current.has(row.id));
      setSources(filteredRows);
      setSourceStatus(filteredRows.length ? "ready" : "empty");
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
      refreshSources({ force: true }).catch(() => {});
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

  const handleDeleteSource = useCallback(
    async (sourceId: string) => {
      if (inFlightSourceDeletesRef.current.has(sourceId)) return;

      inFlightSourceDeletesRef.current.add(sourceId);
      let removedSource: KnowledgeSource | undefined;
      let removedIndex = -1;

      // Instant optimistic removal from the sidebar and workspace
      setSources((current) => {
        removedIndex = current.findIndex((source) => source.id === sourceId);
        if (removedIndex !== -1) {
          removedSource = current[removedIndex];
        }
        const next = current.filter((source) => source.id !== sourceId);
        setSourceStatus(next.length ? "ready" : "empty");
        return next;
      });
      setFocusedDocument((current) => (current?.id === sourceId ? null : current));
      invalidateDocumentsCache();

      try {
        await deleteDocumentById(sourceId);
      } catch {
        if (removedSource) {
          const restored = removedSource;
          setSources((current) => {
            if (current.some((s) => s.id === sourceId)) return current;
            const next = [...current];
            const insertAt = removedIndex >= 0 && removedIndex <= next.length ? removedIndex : 0;
            next.splice(insertAt, 0, restored);
            setSourceStatus(next.length ? "ready" : "empty");
            return next;
          });
        }
      } finally {
        inFlightSourceDeletesRef.current.delete(sourceId);
        setDeletingSourceId(null);
      }
    },
    [],
  );

  const handleRenameSession = useCallback(async (sessionId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return false;

    let previousTitle: string | undefined;
    setRecentSessionRows((current) =>
      current.map((session) => {
        if (session.id === sessionId) {
          previousTitle = session.title;
          return { ...session, title: trimmed, title_status: "generated" as const };
        }
        return session;
      }),
    );

    try {
      const updated = await renameChatSession(sessionId, trimmed);
      setRecentSessionRows((current) =>
        current.map((session) => (session.id === sessionId ? { ...session, title: updated.title } : session)),
      );
      return true;
    } catch {
      if (previousTitle !== undefined) {
        const fallback = previousTitle;
        setRecentSessionRows((current) =>
          current.map((session) => (session.id === sessionId ? { ...session, title: fallback } : session)),
        );
      }
      return false;
    }
  }, []);

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (inFlightSessionDeletesRef.current.has(sessionId)) return;

      inFlightSessionDeletesRef.current.add(sessionId);
      let removedSession: ChatSessionSummary | undefined;
      let removedIndex = -1;

      // Instant optimistic removal from the sidebar
      setRecentSessionRows((current) => {
        removedIndex = current.findIndex((session) => session.id === sessionId);
        if (removedIndex !== -1) {
          removedSession = current[removedIndex];
        }
        return current.filter((session) => session.id !== sessionId);
      });

      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
      }

      lifecycleHandlersRef.current.forEach((handlers) => {
        handlers.onSessionDeleted?.(sessionId);
      });

      try {
        await deleteChatSession(sessionId);
      } catch {
        if (removedSession) {
          const restored = removedSession;
          setRecentSessionRows((current) => {
            if (current.some((s) => s.id === sessionId)) return current;
            const next = [...current];
            const insertAt = removedIndex >= 0 && removedIndex <= next.length ? removedIndex : 0;
            next.splice(insertAt, 0, restored);
            return next;
          });
        }
      } finally {
        inFlightSessionDeletesRef.current.delete(sessionId);
        setDeletingSessionId(null);
      }
    },
    [activeSessionId],
  );

  const openUploadModal = useCallback((target: "personal" | "knowledge_base" = "personal") => {
    setUploadTarget(target);
    setIsUploadOpen(true);
  }, []);

  const handleUploadToast = useCallback(
    (toast: UploadToastPayload) => {
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
    },
    [refreshSources],
  );

  const focusDocumentInChat = useCallback(
    (doc: FocusedDocument) => {
      const matched = sources.find((source) => source.id === doc.id);
      if (matched?.sourceType === "knowledge-base" && !preferences.includeKnowledgeBase) {
        updatePreference("includeKnowledgeBase", true);
      }
      setFocusedDocument(doc);
      if (pathname !== "/chat") {
        router.push("/chat");
      }
    },
    [pathname, preferences.includeKnowledgeBase, router, sources, updatePreference],
  );

  const activeFocusedDocument = useMemo(() => {
    if (!focusedDocument) return null;
    if (!preferences.includeKnowledgeBase) {
      const matched = sources.find((source) => source.id === focusedDocument.id);
      if (matched?.sourceType === "knowledge-base") return null;
    }
    return focusedDocument;
  }, [focusedDocument, preferences.includeKnowledgeBase, sources]);

  const toggleKnowledgeBase = useCallback(() => {
    const next = !preferences.includeKnowledgeBase;
    updatePreference("includeKnowledgeBase", next);
    if (!next) {
      setFocusedDocument((current) => {
        if (!current) return null;
        const matched = sources.find((source) => source.id === current.id);
        return matched?.sourceType === "knowledge-base" ? null : current;
      });
    }
  }, [preferences.includeKnowledgeBase, sources, updatePreference]);

  const handleNewChatClick = useCallback(() => {
    setActiveSessionId(null);
    setIsTemporaryChat(false);
    lifecycleHandlersRef.current.forEach((handlers) => {
      handlers.onNewChat?.();
    });
    if (pathname !== "/chat") {
      router.push("/chat");
    }
  }, [pathname, router]);

  const handleToggleTemporaryChatClick = useCallback(() => {
    lifecycleHandlersRef.current.forEach((handlers) => {
      handlers.onToggleTemporaryChat?.();
    });
  }, []);

  const workspaceContextValue = useMemo<WorkspaceContextValue>(
    () => ({
      sources,
      setSources,
      sourceStatus,
      setSourceStatus,
      refreshSources,
      handleDeleteSource,
      deletingSourceId,
      recentSessionRows,
      setRecentSessionRows,
      activeSessionId,
      setActiveSessionId,
      isTemporaryChat,
      setIsTemporaryChat,
      refreshRecentChats,
      handleDeleteSession,
      handleRenameSession,
      deletingSessionId,
      isAdmin,
      includeKnowledgeBase: preferences.includeKnowledgeBase,
      toggleKnowledgeBase,
      focusedDocument: activeFocusedDocument,
      setFocusedDocument,
      focusDocumentInChat,
      openUploadModal,
      handleUploadToast,
      registerSessionLifecycle,
    }),
    [
      activeFocusedDocument,
      activeSessionId,
      deletingSessionId,
      deletingSourceId,
      focusDocumentInChat,
      handleDeleteSession,
      handleDeleteSource,
      handleRenameSession,
      handleUploadToast,
      isAdmin,
      isTemporaryChat,
      openUploadModal,
      preferences.includeKnowledgeBase,
      recentSessionRows,
      refreshRecentChats,
      refreshSources,
      registerSessionLifecycle,
      sourceStatus,
      sources,
      toggleKnowledgeBase,
    ],
  );

  if (isLoaded && (!isSignedIn || !user)) return null;

  return (
    <WorkspaceContext.Provider value={workspaceContextValue}>
      <AcademicWorkspace
        groups={sourceGroups}
        recentChats={recentChats}
        sourceStatus={sourceStatus}
        deletingSourceId={deletingSourceId}
        deletingSessionId={deletingSessionId}
        focusedSourceId={activeFocusedDocument?.id ?? null}
        includeKnowledgeBase={preferences.includeKnowledgeBase}
        isTemporaryChat={pathname === "/chat" && isTemporaryChat}
        onToggleTemporaryChat={pathname === "/chat" ? handleToggleTemporaryChatClick : undefined}
        onToggleKnowledgeBase={toggleKnowledgeBase}
        onSelectSource={(source) => {
          if (source.sourceType === "knowledge-base" && !preferences.includeKnowledgeBase) {
            return;
          }
          if (source.status === "indexed") {
            focusDocumentInChat({ id: source.id, filename: source.filename });
          }
        }}
        onDeleteSource={handleDeleteSource}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onOpenSession={(sessionId) => {
          setIsTemporaryChat(false);
          router.push(`/chat?session=${encodeURIComponent(sessionId)}`);
        }}
        onNewChat={handleNewChatClick}
        onOpenUpload={() => openUploadModal("personal")}
        onOpenKnowledgeBaseUpload={isAdmin ? () => openUploadModal("knowledge_base") : undefined}
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
          onUploadToast={handleUploadToast}
          completedDocumentIds={completedDocumentIds}
          failedDocuments={failedDocuments}
        />
        <IndexingToast
          toasts={uploadToasts}
          onDismiss={(toastId) => setUploadToasts((current) => current.filter((toast) => toast.toastId !== toastId))}
        />
      </AcademicWorkspace>
    </WorkspaceContext.Provider>
  );
}
