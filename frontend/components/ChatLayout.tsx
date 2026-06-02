"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AcademicWorkspace } from "./chat/AcademicWorkspace";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessage } from "./chat/ChatMessage";
import { ChatWelcome } from "./chat/ChatWelcome";
import { SUGGESTIONS } from "./SuggestedQueries";
import { RetrievalStatus as RetrievalStatusBanner } from "./sources/RetrievalStatus";
import { IndexingToast, type UploadIndexingToast } from "./upload/IndexingToast";
import { UploadModal } from "./upload/UploadModal";
import { useAuth } from "../context/AuthContext";
import {
  deleteChatSession,
  fetchChatSessionMessages,
  fetchChatSessions,
  streamChatQuestion,
  type ChatMessage as ChatMessageType,
  type ChatSessionSummary,
} from "../lib/chat-api";
import type { AutocompleteSuggestion } from "../lib/trie-autocomplete";
import { uploadDocumentFile, type UploadToastPayload } from "../lib/upload-document";
import {
  createSourceGroups,
  getFileType,
  type KnowledgeSource,
  type RetrievalMatch,
  type RetrievalStatus,
} from "../lib/ui-state";

type SupabaseKnowledgeSource = {
  id: string;
  filename: string;
  created_at?: string;
  processing_status?: "uploaded" | "queued" | "processing" | "indexed" | "failed";
  processing_error?: string | null;
  indexed_at?: string | null;
};

type AutocompleteResponse = {
  ok: boolean;
  suggestions?: AutocompleteSuggestion[];
};

type DocumentsResponse = {
  ok: boolean;
  documents?: SupabaseKnowledgeSource[];
};

type QueuedChatMessage = {
  id: string;
  question: string;
  selectedSuggestion?: AutocompleteSuggestion;
  createdAt: number;
};

const QUEUE_LIMIT = 3;

function toAutocompleteId(input: string) {
  return input.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

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

function toRetrievalMatches(messages: ChatMessageType[]): RetrievalMatch[] {
  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.sources?.length);

  return (latestAssistant?.sources ?? []).slice(0, 3).map((source) => ({
    id: `${source.document_id}-${source.chunk_id}`,
    sourceId: source.document_id,
    filename: source.filename,
    locator: `Chunk ${source.chunk_index}`,
    snippet: source.chunk_id,
    scoreLabel: "Retrieved match",
  }));
}

export function ChatLayout() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [queuedMessages, setQueuedMessages] = useState<QueuedChatMessage[]>([]);
  const [recentSessionRows, setRecentSessionRows] = useState<ChatSessionSummary[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [serverAutocompleteSuggestions, setServerAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">(
    "loading",
  );
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [pollDocuments, setPollDocuments] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [uploadToasts, setUploadToasts] = useState<UploadIndexingToast[]>([]);
  const [isChatFileDragging, setIsChatFileDragging] = useState(false);
  const loadedSessionRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const queuedMessagesRef = useRef<QueuedChatMessage[]>([]);
  const conversationRunRef = useRef(0);
  const isLoadingRef = useRef(false);
  const isLoadingSessionRef = useRef(false);
  const chatDragDepthRef = useRef(0);
  const completedDocumentIds = useMemo(
    () => new Set(sources.filter((source) => source.status === "indexed").map((source) => source.id)),
    [sources],
  );
  const failedDocuments = useMemo(
    () => new Map(sources.filter((source) => source.status === "failed").map((source) => [source.id, source.summary ?? "Indexing failed"])),
    [sources],
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const sessionParam = searchParams.get("session");

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    queuedMessagesRef.current = queuedMessages;
  }, [queuedMessages]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  useEffect(() => {
    isLoadingSessionRef.current = isLoadingSession;
  }, [isLoadingSession]);

  const sourceGroups = useMemo(() => createSourceGroups(sources), [sources]);
  const recentChats = useMemo(() => recentSessionRows.map((session) => ({
    id: session.id,
    title: session.title || "New chat",
    lastMessageAt: session.updated_at
      ? new Date(session.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : undefined,
    status: session.id === activeSessionId ? "active" as const : "inactive" as const,
  })), [activeSessionId, recentSessionRows]);
  const retrievalMatches = useMemo(() => toRetrievalMatches(messages), [messages]);
  const retrievalStatus = useMemo<RetrievalStatus>(() => {
    if (isLoading) {
      return {
        state: "retrieving",
        message: "Searching your indexed documents...",
        matches: [],
      };
    }

    return { state: "complete", message: "Sources ready", matches: retrievalMatches };
  }, [isLoading, retrievalMatches]);

  const autocompleteSuggestions = useMemo<AutocompleteSuggestion[]>(() => {
    const promptSuggestions = SUGGESTIONS.map((suggestion) => ({
      id: `prompt-${toAutocompleteId(suggestion)}`,
      label: suggestion,
      value: suggestion,
      type: "prompt" as const,
    }));

    const historySuggestions = messages
      .filter((message) => message.role === "user")
      .slice(-5)
      .map((message) => ({
        id: `history-${message.id}`,
        label: message.content,
        value: message.content,
        type: "history" as const,
      }));

    const seen = new Set<string>();
    return [...promptSuggestions, ...serverAutocompleteSuggestions, ...historySuggestions].filter((suggestion) => {
      const key = `${suggestion.type}:${suggestion.value.toLocaleLowerCase().replace(/\s+/g, " ").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [messages, serverAutocompleteSuggestions]);

  const refreshRecentChats = useCallback(async () => {
    try {
      setRecentSessionRows(await fetchChatSessions());
    } catch {
      setRecentSessionRows([]);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      conversationRunRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      setSources([]);
      setRecentSessionRows([]);
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      setMessages([]);
      setQueuedMessages([]);
      queuedMessagesRef.current = [];
      loadedSessionRef.current = null;
      setSourceStatus("unavailable");
      router.replace("/sign-in?next=/chat");
      return;
    }

    let active = true;

    async function loadSources() {
      try {
        const response = await fetch("/api/documents");
        const result = (await response.json()) as DocumentsResponse;

        if (!active) return;

        if (!response.ok || !result.ok) {
          setSourceStatus("unavailable");
          return;
        }

        const documents = result.documents ?? [];
        const rows = documents.map(toUploadedSource);
        setSources(rows);
        setPollDocuments(rows.some((source) => source.status === "indexing"));
        setSourceStatus(rows.length ? "ready" : "empty");
      } catch {
        if (active) setSourceStatus("unavailable");
      }
    }

    async function loadAutocomplete() {
      try {
        const response = await fetch("/api/autocomplete");
        const result = (await response.json()) as AutocompleteResponse;
        if (active && response.ok && result.ok) setServerAutocompleteSuggestions(result.suggestions ?? []);
      } catch {
        if (active) setServerAutocompleteSuggestions([]);
      }
    }

    loadSources();
    loadAutocomplete();
    refreshRecentChats();

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, refreshRecentChats, router, user]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const sessionId = sessionParam;
    if (!sessionId) {
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      loadedSessionRef.current = null;
      setIsLoadingSession(false);
      isLoadingSessionRef.current = false;
      return;
    }

    if (sessionId === loadedSessionRef.current) return;

    const requestedSessionId = sessionId;
    let active = true;
    const abortController = new AbortController();
    const timeout = window.setTimeout(() => abortController.abort(), 15000);
    setIsLoadingSession(true);
    isLoadingSessionRef.current = true;

    async function loadSession() {
      try {
        const result = await fetchChatSessionMessages(requestedSessionId, abortController.signal);
        if (!active) return;
        loadedSessionRef.current = result.session.id;
        setActiveSessionId(result.session.id);
        activeSessionIdRef.current = result.session.id;
        setMessages(result.messages);
        setIsLoadingSession(false);
        isLoadingSessionRef.current = false;
        void refreshRecentChats();
      } catch {
        if (!active) return;
        setActiveSessionId(null);
        activeSessionIdRef.current = null;
        setMessages([]);
        loadedSessionRef.current = null;
        window.history.replaceState(null, "", "/chat");
      } finally {
        window.clearTimeout(timeout);
        if (active) {
          setIsLoadingSession(false);
          isLoadingSessionRef.current = false;
        }
      }
    }

    loadSession();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [isLoaded, isSignedIn, refreshRecentChats, sessionParam, user]);

  useEffect(() => {
    if (!pollDocuments) return;

    let active = true;

    async function refreshIndexedState() {
      try {
        const response = await fetch("/api/documents");
        const result = (await response.json()) as DocumentsResponse;
        if (!active || !response.ok || !result.ok) return;

        const rows = (result.documents ?? []).map(toUploadedSource);
        const hasIndexingSources = rows.some((source) => source.status === "indexing");
        setSources(rows);
        setPollDocuments(hasIndexingSources);

        const autocompleteResponse = await fetch("/api/autocomplete");
        const autocompleteResult = (await autocompleteResponse.json()) as AutocompleteResponse;
        if (active && autocompleteResponse.ok && autocompleteResult.ok) {
          setServerAutocompleteSuggestions(autocompleteResult.suggestions ?? []);
        }
      } catch {
      }
    }

    refreshIndexedState();
    const interval = window.setInterval(refreshIndexedState, 3000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [pollDocuments]);

  // Update toast status from polling results
  useEffect(() => {
    setUploadToasts((current) =>
      current.map((toast) => {
        if (toast.status !== "uploading" && toast.status !== "indexing") return toast;

        if (toast.documentId && completedDocumentIds.has(toast.documentId)) {
          return { ...toast, status: "completed" as const };
        }

        const failure = toast.documentId ? failedDocuments.get(toast.documentId) : undefined;
        if (failure) {
          return { ...toast, status: "failed" as const, errorMessage: failure };
        }

        return toast;
      }),
    );
  }, [completedDocumentIds, failedDocuments]);

  // Auto-dismiss completed toasts after green flash
  useEffect(() => {
    const completedIds = uploadToasts
      .filter((t) => t.status === "completed")
      .map((t) => t.toastId);

    if (completedIds.length === 0) return;

    const timeout = window.setTimeout(() => {
      setUploadToasts((current) =>
        current.filter((t) => !completedIds.includes(t.toastId)),
      );
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [uploadToasts]);

  const dismissToast = useCallback((toastId: string) => {
    setUploadToasts((current) => current.filter((t) => t.toastId !== toastId));
  }, []);

  const handleUploadToast = useCallback(({ toastId, documentId, filename, status, queuedAt, errorMessage }: UploadToastPayload) => {
    if (documentId) setPollDocuments(true);
    setUploadToasts((current) => {
      const existing = current.find((t) => t.toastId === toastId);
      const nextToast: UploadIndexingToast = {
        toastId,
        documentId: documentId ?? existing?.documentId,
        filename,
        queuedAt: queuedAt ?? existing?.queuedAt ?? Date.now(),
        status,
        errorMessage,
      };

      return [...current.filter((t) => t.toastId !== toastId), nextToast];
    });
  }, []);

  const uploadDroppedFiles = useCallback((files: File[]) => {
    if (!files.length) return;

    files.forEach((file) => {
      void uploadDocumentFile({
        file,
        userId: user?.id,
        isAuthLoaded: isLoaded,
        isSignedIn,
        toastValidationFailures: true,
        onToast: handleUploadToast,
      });
    });
  }, [handleUploadToast, isLoaded, isSignedIn, user]);

  function hasDraggedFiles(event: DragEvent) {
    return Array.from(event.dataTransfer.types).includes("Files");
  }

  const handleChatDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    chatDragDepthRef.current += 1;
    setIsChatFileDragging(true);
  }, []);

  const handleChatDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsChatFileDragging(true);
  }, []);

  const handleChatDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    chatDragDepthRef.current = Math.max(0, chatDragDepthRef.current - 1);
    if (chatDragDepthRef.current === 0) setIsChatFileDragging(false);
  }, []);

  const handleChatDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    chatDragDepthRef.current = 0;
    setIsChatFileDragging(false);
    uploadDroppedFiles(Array.from(event.dataTransfer.files));
  }, [uploadDroppedFiles]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const runQuestion = useCallback(
    async (question: string, selectedSuggestion?: AutocompleteSuggestion, runScope = conversationRunRef.current) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || isLoadingSessionRef.current) return;

      const now = Date.now();
      const userMessage: ChatMessageType = {
        id: `user-${now}`,
        role: "user",
        content: trimmedQuestion,
        status: "complete",
        createdAt: now,
      };
      const assistantId = `assistant-${now}`;
      const assistantPlaceholder: ChatMessageType = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "loading",
        createdAt: now + 1,
      };

      setMessages((current) => [...current, userMessage, assistantPlaceholder]);
      setIsLoading(true);
      isLoadingRef.current = true;

      let streamedAnswer = "";
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await streamChatQuestion(trimmedQuestion, {
          onDelta: (text) => {
            streamedAnswer += text;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: streamedAnswer,
                      displayedContent: streamedAnswer,
                      status: "complete",
                    }
                  : message,
              ),
            );
          },
          onSources: (sources) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? { ...message, sources }
                  : message,
              ),
            );
          },
          onDone: (response) => {
            if (response.chatSessionId) {
              activeSessionIdRef.current = response.chatSessionId;
              setActiveSessionId(response.chatSessionId);
              loadedSessionRef.current = response.chatSessionId;
              window.history.replaceState(null, "", `/chat?session=${encodeURIComponent(response.chatSessionId)}`);
            }
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantId
                  ? {
                      ...message,
                      content: response.answer,
                      displayedContent: undefined,
                      sources: response.sources,
                      status: "complete",
                    }
                  : message,
              ),
            );
            void refreshRecentChats();
            window.setTimeout(() => void refreshRecentChats(), 2500);
          },
        }, {
          ...(selectedSuggestion?.metadata ? { retrievalHint: selectedSuggestion.metadata } : {}),
          ...(activeSessionIdRef.current ? { chatSessionId: activeSessionIdRef.current } : {}),
          signal: abortController.signal,
        });
      } catch (error) {
        const isAbort = error instanceof DOMException
          ? error.name === "AbortError"
          : error instanceof Error && error.name === "AbortError";

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? isAbort
                ? {
                    ...message,
                    content: streamedAnswer,
                    displayedContent: undefined,
                    status: "complete",
                  }
                : {
                    ...message,
                    content:
                      error instanceof Error
                        ? error.message
                        : "The assistant could not answer this question.",
                    displayedContent: undefined,
                    status: "error",
                  }
              : message,
          ),
        );
      } finally {
        if (abortControllerRef.current === abortController) abortControllerRef.current = null;
        setIsLoading(false);
        isLoadingRef.current = false;

        if (conversationRunRef.current !== runScope) return;

        const [nextQueuedMessage, ...remainingQueuedMessages] = queuedMessagesRef.current;
        if (!nextQueuedMessage) return;

        queuedMessagesRef.current = remainingQueuedMessages;
        setQueuedMessages(remainingQueuedMessages);
        void runQuestion(nextQueuedMessage.question, nextQueuedMessage.selectedSuggestion, runScope);
      }
    },
    [refreshRecentChats],
  );

  const handleSubmit = useCallback(
    (question: string, selectedSuggestion?: AutocompleteSuggestion) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || isLoadingSessionRef.current) return false;

      if (!isLoadingRef.current) {
        void runQuestion(trimmedQuestion, selectedSuggestion);
        return true;
      }

      if (queuedMessagesRef.current.length >= QUEUE_LIMIT) return false;

      const queuedMessage: QueuedChatMessage = {
        id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        question: trimmedQuestion,
        selectedSuggestion,
        createdAt: Date.now(),
      };

      const nextQueuedMessages = [...queuedMessagesRef.current, queuedMessage];
      queuedMessagesRef.current = nextQueuedMessages;
      setQueuedMessages(nextQueuedMessages);

      return true;
    },
    [runQuestion],
  );

  const handleRemoveQueuedMessage = useCallback((queuedMessageId: string) => {
    setQueuedMessages((current) => {
      const next = current.filter((message) => message.id !== queuedMessageId);
      queuedMessagesRef.current = next;
      return next;
    });
  }, []);

  const handleStopResponse = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleNewChat = useCallback(() => {
    conversationRunRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsLoadingSession(false);
    setIsLoading(false);
    isLoadingRef.current = false;
    isLoadingSessionRef.current = false;
    setActiveSessionId(null);
    activeSessionIdRef.current = null;
    setMessages([]);
    setQueuedMessages([]);
    queuedMessagesRef.current = [];
    loadedSessionRef.current = null;
    window.history.pushState(null, "", "/chat");
  }, []);

  const handleOpenSession = useCallback((sessionId: string) => {
    if (isLoading) return;
    router.push(`/chat?session=${encodeURIComponent(sessionId)}`);
  }, [isLoading, router]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (deletingSessionId) return;

    setDeletingSessionId(sessionId);
    try {
      await deleteChatSession(sessionId);
      setRecentSessionRows((current) => current.filter((session) => session.id !== sessionId));
      if (sessionId === activeSessionId) {
        setActiveSessionId(null);
        activeSessionIdRef.current = null;
        setMessages([]);
        setQueuedMessages([]);
        queuedMessagesRef.current = [];
        loadedSessionRef.current = null;
        router.push("/chat");
      }
      await refreshRecentChats();
    } catch {
    } finally {
      setDeletingSessionId(null);
    }
  }, [activeSessionId, deletingSessionId, refreshRecentChats, router]);

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
      setServerAutocompleteSuggestions([]);
    } catch {
      setSourceStatus("unavailable");
    } finally {
      setDeletingSourceId(null);
    }
  }, [deletingSourceId]);

  if (!isLoaded || !isSignedIn || !user) {
    return null;
  }

  return (
    <AcademicWorkspace
      groups={sourceGroups}
      recentChats={recentChats}
      sourceStatus={sourceStatus}
      deletingSourceId={deletingSourceId}
      deletingSessionId={deletingSessionId}
      onDeleteSource={handleDeleteSource}
      onDeleteSession={handleDeleteSession}
      onOpenSession={handleOpenSession}
      onNewChat={handleNewChat}
      onOpenUpload={() => setIsUploadOpen(true)}
    >
      <ChatHeader onOpenUpload={() => setIsUploadOpen(true)} />
      <div
        className="relative flex min-h-0 flex-1"
        onDragEnter={handleChatDragEnter}
        onDragLeave={handleChatDragLeave}
        onDragOver={handleChatDragOver}
        onDrop={handleChatDrop}
      >
        {isChatFileDragging && (
          <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-cyan-300/70 bg-slate-950/75 text-cyan-50 shadow-2xl shadow-cyan-950/30 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
                <UploadCloud className="h-7 w-7" />
              </span>
              <span className="text-base font-semibold">Drop files to upload</span>
              <span className="text-xs text-slate-300">PDF, DOCX, PPTX, and TXT files upload directly into your sources.</span>
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="flex min-h-full flex-col">
              <div className="flex-1 pb-6">
                {isLoadingSession ? (
                  <div className="mx-auto max-w-5xl py-10 text-sm text-slate-400">Loading conversation...</div>
                ) : messages.length === 0 ? (
                  <ChatWelcome disabled={isLoading} onSelect={handleSubmit} />
                ) : (
                  <div className="mx-auto max-w-5xl space-y-5">
                    {isLoading || retrievalStatus.matches?.length ? (
                      <RetrievalStatusBanner status={retrievalStatus} />
                    ) : null}
                    {messages.map((message) => (
                      <ChatMessage key={message.id} message={message} />
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 z-20 -mx-4 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent px-4 pb-6 pt-6 sm:-mx-6 sm:px-6">
                <ChatComposer
                  autocompleteSuggestions={autocompleteSuggestions}
                  disabled={isLoadingSession}
                  isResponding={isLoading}
                  queuedMessages={queuedMessages}
                  queueLimit={QUEUE_LIMIT}
                  onSubmit={handleSubmit}
                  onRemoveQueuedMessage={handleRemoveQueuedMessage}
                  onStopResponse={handleStopResponse}
                  onOpenUpload={() => setIsUploadOpen(true)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadToast={handleUploadToast}
        completedDocumentIds={completedDocumentIds}
        failedDocuments={failedDocuments}
      />
      <IndexingToast toasts={uploadToasts} onDismiss={dismissToast} />
    </AcademicWorkspace>
  );
}
