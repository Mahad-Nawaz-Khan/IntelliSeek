"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AcademicWorkspace } from "./chat/AcademicWorkspace";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessage } from "./chat/ChatMessage";
import { ChatWelcome } from "./chat/ChatWelcome";
import { DemoLimitModal } from "./demo/DemoSignupModal";
import { SUGGESTIONS } from "./SuggestedQueries";
import { RetrievalStatus } from "./sources/RetrievalStatus";
import { IndexingToast, type UploadIndexingToast } from "./upload/IndexingToast";
import { UploadModal } from "./upload/UploadModal";
import { useAuth } from "../context/AuthContext";
import { useDemo } from "../context/DemoContext";
import {
  deleteChatSession,
  fetchChatSessionMessages,
  fetchChatSessions,
  renameChatSession,
  streamChatQuestion,
  streamChatQuestionDemo,
  type ChatMessage as ChatMessageType,
  type ChatSessionSummary,
} from "../lib/chat-api";
import { fetchAccessibleDocuments } from "../lib/documents";
import type { AutocompleteSuggestion } from "../lib/trie-autocomplete";
import { uploadDocumentFile, type UploadToastPayload } from "../lib/upload-document";
import { createSourceGroups, type KnowledgeSource } from "../lib/ui-state";

type AutocompleteResponse = {
  ok: boolean;
  suggestions?: AutocompleteSuggestion[];
};

type QueuedChatMessage = {
  id: string;
  question: string;
  selectedSuggestion?: AutocompleteSuggestion;
  createdAt: number;
};

const QUEUE_LIMIT = 3;

type ChatLayoutProps = {
  embedded?: boolean;
  demo?: boolean;
};

function toAutocompleteId(input: string) {
  return input.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(?:^-)|(?:-$)/g, "");
}

function patchAssistantMessage(
  messages: ChatMessageType[],
  assistantId: string,
  patch: Partial<ChatMessageType>,
): ChatMessageType[] {
  return messages.map((message) => (message.id === assistantId ? { ...message, ...patch } : message));
}

function updateSessionTitleInRows(
  rows: ChatSessionSummary[],
  sessionId: string,
  title: string,
): ChatSessionSummary[] {
  return rows.map((session) =>
    session.id === sessionId ? { ...session, title, title_status: "generated" as const } : session,
  );
}

function resolveErrorMessage(
  error: unknown,
  isAbort: boolean,
  streamedAnswer: string,
): { content: string; status: "complete" | "error" } {
  if (isAbort) {
    return {
      content: streamedAnswer,
      status: "complete",
    };
  }
  return {
    content: error instanceof Error ? error.message : "The assistant could not answer this question.",
    status: "error",
  };
}

type ChatConversationViewProps = {
  isLoadingSession: boolean;
  messages: ChatMessageType[];
  isLoading: boolean;
  onSubmit: (question: string) => boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
};

function ChatConversationView({
  isLoadingSession,
  messages,
  isLoading,
  onSubmit,
  bottomRef,
}: Readonly<ChatConversationViewProps>) {
  if (isLoadingSession) {
    return <div className="mx-auto max-w-5xl py-10 text-sm text-slate-400">Loading conversation...</div>;
  }
  if (messages.length === 0) {
    return <ChatWelcome disabled={isLoading} onSelect={onSubmit} />;
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export function ChatLayout({ embedded = false, demo = false }: Readonly<ChatLayoutProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useAuth();
  const { hasReachedLimit, decrementQuestion, remaining } = useDemo();
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
  const [showSignupModal, setShowSignupModal] = useState(false);
  const loadedSessionRef = useRef<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
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
    status: session.id === activeSessionId ? "active" as const : "inactive" as const,
  })), [activeSessionId, recentSessionRows]);
  // While an answer is being prepared, the pill names the actual phase: the
  // sources event arrives before the first token, so "sources present on the
  // streaming message" is the honest line between searching and writing.
  const latestMessage = messages.length ? messages[messages.length - 1] : undefined;
  const retrievalMessage =
    isLoading && latestMessage?.role === "assistant" && latestMessage.sources?.length
      ? "Writing your answer..."
      : "Searching your indexed documents...";

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
    if (demo) return;
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      conversationRunRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      activeJobIdRef.current = null;
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
        const rows = await fetchAccessibleDocuments();

        if (!active) return;

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
  }, [isLoaded, isSignedIn, refreshRecentChats, router, user, demo]);

  useEffect(() => {
    if (demo) return;
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
        refreshRecentChats().catch(() => {});
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
  }, [isLoaded, isSignedIn, refreshRecentChats, sessionParam, user, demo]);

  useEffect(() => {
    if (demo) return;
    if (!pollDocuments) return;

    let active = true;

    async function refreshIndexedState() {
      try {
        const rows = await fetchAccessibleDocuments();
        if (!active) return;

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
  }, [pollDocuments, demo]);

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

    const filterCompletedToasts = (current: UploadIndexingToast[]) =>
      current.filter((t) => !completedIds.includes(t.toastId));

    const timeout = window.setTimeout(() => {
      setUploadToasts(filterCompletedToasts);
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
    if (!files.length || demo) return;

    files.forEach((file) => {
      uploadDocumentFile({
        file,
        userId: user?.id,
        isAuthLoaded: isLoaded,
        isSignedIn,
        toastValidationFailures: true,
        onToast: handleUploadToast,
      }).catch(() => {});
    });
  }, [demo, handleUploadToast, isLoaded, isSignedIn, user]);

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
      // The session this question belongs to as of right now. If it changes
      // before the stream finishes, the user has navigated elsewhere and the
      // completion must not touch the current view (see onDone below).
      const sessionAtSend = activeSessionIdRef.current;

      // A fallback provider restarts the answer from the beginning, so the
      // partial text from the failed attempt is discarded rather than prefixed
      // to the retry.
      const resetStreamedAnswer = () => {
        streamedAnswer = "";
        setMessages((current) =>
          patchAssistantMessage(current, assistantId, {
            content: "",
            displayedContent: "",
            status: "loading",
          }),
        );
      };

      try {
        if (demo) {
          await streamChatQuestionDemo(trimmedQuestion, {
            onDelta: (text) => {
              streamedAnswer += text;
              setMessages((current) =>
                patchAssistantMessage(current, assistantId, {
                  content: streamedAnswer,
                  displayedContent: streamedAnswer,
                  status: "complete",
                }),
              );
            },
            onReset: resetStreamedAnswer,
            onSources: (sources) => {
              setMessages((current) =>
                patchAssistantMessage(current, assistantId, { sources }),
              );
            },
            onDone: (response) => {
              setMessages((current) =>
                patchAssistantMessage(current, assistantId, {
                  content: response.answer,
                  displayedContent: undefined,
                  sources: response.sources,
                  status: "complete",
                }),
              );
            },
          }, abortController.signal);
        } else {
          await streamChatQuestion(trimmedQuestion, {
            onJob: (jobId) => {
              activeJobIdRef.current = jobId;
            },
            onDelta: (text) => {
              streamedAnswer += text;
              setMessages((current) =>
                patchAssistantMessage(current, assistantId, {
                  content: streamedAnswer,
                  displayedContent: streamedAnswer,
                  status: "complete",
                }),
              );
            },
            onReset: resetStreamedAnswer,
            onSources: (sources) => {
              setMessages((current) =>
                patchAssistantMessage(current, assistantId, { sources }),
              );
            },
            onDone: (response) => {
              const completedSessionId = response.chatSessionId;
              // While generating, the user may have opened another chat. The
              // server persists the answer either way; only touch this view's
              // state when the user is still on the conversation asked in.
              const stillAttached =
                conversationRunRef.current === runScope && activeSessionIdRef.current === sessionAtSend;

              if (stillAttached) {
                if (completedSessionId) {
                  activeSessionIdRef.current = completedSessionId;
                  setActiveSessionId(completedSessionId);
                  loadedSessionRef.current = completedSessionId;
                  window.history.replaceState(null, "", `/chat?session=${encodeURIComponent(completedSessionId)}`);
                }
                setMessages((current) =>
                  patchAssistantMessage(current, assistantId, {
                    content: response.answer,
                    displayedContent: undefined,
                    sources: response.sources,
                    status: "complete",
                  }),
                );
              } else if (completedSessionId && loadedSessionRef.current === completedSessionId) {
                // Invalidate the cached load so revisiting the session
                // refetches and shows the answer that completed in the
                // background.
                loadedSessionRef.current = null;
              }
              refreshRecentChats().catch(() => {});
            },
            // The title is generated after the answer, so it is applied when it
            // arrives instead of guessing at a delay and re-fetching the list.
            onTitle: (title) => {
              const sessionId = activeSessionIdRef.current;
              if (!sessionId) return;
              setRecentSessionRows((current) => {
                // The list refresh triggered by `done` may not have landed yet;
                // re-fetching is what picks the new session up in that case.
                if (!current.some((session) => session.id === sessionId)) {
                  refreshRecentChats().catch(() => {});
                  return current;
                }
                return updateSessionTitleInRows(current, sessionId, title);
              });
            },
          }, {
            ...(selectedSuggestion?.metadata ? { retrievalHint: selectedSuggestion.metadata } : {}),
            ...(activeSessionIdRef.current ? { chatSessionId: activeSessionIdRef.current } : {}),
            signal: abortController.signal,
          });
        }
      } catch (error) {
        const isAbort = error instanceof DOMException
          ? error.name === "AbortError"
          : error instanceof Error && error.name === "AbortError";

        const resolved = resolveErrorMessage(error, isAbort, streamedAnswer);
        setMessages((current) =>
          patchAssistantMessage(current, assistantId, {
            content: resolved.content,
            displayedContent: undefined,
            status: resolved.status,
          }),
        );
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
          activeJobIdRef.current = null;
        }
        setIsLoading(false);
        isLoadingRef.current = false;

        if (conversationRunRef.current === runScope) {
          const [nextQueuedMessage, ...remainingQueuedMessages] = queuedMessagesRef.current;
          if (nextQueuedMessage) {
            queuedMessagesRef.current = remainingQueuedMessages;
            setQueuedMessages(remainingQueuedMessages);
            runQuestion(nextQueuedMessage.question, nextQueuedMessage.selectedSuggestion, runScope).catch(() => {});
          }
        }
      }
    },
    [demo, refreshRecentChats],
  );

  const handleSubmit = useCallback(
    (question: string, selectedSuggestion?: AutocompleteSuggestion) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || isLoadingSessionRef.current) return false;

      if (demo) {
        if (hasReachedLimit) {
          setShowSignupModal(true);
          return false;
        }
        const accepted = decrementQuestion();
        if (!accepted) {
          setShowSignupModal(true);
          return false;
        }
      }

      if (!isLoadingRef.current) {
        runQuestion(trimmedQuestion, selectedSuggestion).catch(() => {});
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
    [demo, hasReachedLimit, runQuestion, decrementQuestion],
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
    const jobId = activeJobIdRef.current;
    activeJobIdRef.current = null;
    if (!jobId) return;
    // Tearing down the fetch only stops the visible stream; this asks the
    // server to cancel the background job too, so generation truly ends and
    // only the partial answer seen so far is persisted.
    fetch("/api/chat/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    }).catch(() => {});
  }, []);

  const handleNewChat = useCallback(() => {
    conversationRunRef.current += 1;
    if (demo) {
      // The demo stream is a local fake with nothing to persist; cancel it.
      abortControllerRef.current?.abort();
    } else {
      // Detach instead of aborting: the answer keeps generating server-side
      // and is saved to its session even though this view is being reset.
      abortControllerRef.current = null;
      activeJobIdRef.current = null;
    }
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
    if (!demo) window.history.pushState(null, "", "/chat");
  }, [demo]);

  const handleOpenSession = useCallback((sessionId: string) => {
    if (isLoading || demo) return;
    router.push(`/chat?session=${encodeURIComponent(sessionId)}`);
  }, [demo, isLoading, router]);

  const handleRenameSession = useCallback(async (sessionId: string, title: string) => {
    if (demo) return false;
    try {
      const updated = await renameChatSession(sessionId, title);
      setRecentSessionRows((current) =>
        current.map((session) => (session.id === sessionId ? { ...session, title: updated.title } : session)),
      );
      return true;
    } catch {
      return false;
    }
  }, [demo]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (deletingSessionId || demo) return;

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
  }, [activeSessionId, demo, deletingSessionId, refreshRecentChats, router]);

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    if (deletingSourceId || demo) return;

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
  }, [demo, deletingSourceId]);

  if (!isLoaded || (!demo && (!isSignedIn || !user))) {
    return null;
  }

  const chatContent = (
    <>
      <ChatHeader onOpenUpload={demo ? () => setShowSignupModal(true) : () => setIsUploadOpen(true)} />
      <div
        className="relative flex min-h-0 flex-1"
        onDragEnter={demo ? undefined : handleChatDragEnter}
        onDragLeave={demo ? undefined : handleChatDragLeave}
        onDragOver={demo ? undefined : handleChatDragOver}
        onDrop={demo ? undefined : handleChatDrop}
      >
        {isChatFileDragging && (
          <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-cyan-300/70 bg-slate-950/75 text-cyan-50 shadow-2xl shadow-cyan-950/30 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
                <UploadCloud className="h-7 w-7" />
              </span>
              <span className="text-base font-semibold">Drop files to upload</span>
              <span className="text-xs text-slate-300">PDF, DOCX, PPTX, TXT, and MD files upload directly into your sources.</span>
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="flex min-h-full flex-col">
              <div className="flex-1 pb-6">
                <ChatConversationView
                  isLoadingSession={isLoadingSession}
                  messages={messages}
                  isLoading={isLoading}
                  onSubmit={handleSubmit}
                  bottomRef={bottomRef}
                />
              </div>

              <div className="sticky bottom-0 z-20 -mx-4 px-4 pb-6 pt-6 sm:-mx-6 sm:px-6">
                {demo && hasReachedLimit && (
                  <div className="mx-auto mb-3 flex w-full max-w-5xl items-center gap-2 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-2.5 text-sm text-red-100 shadow-lg">
                    <span className="font-semibold">Demo limit reached.</span>
                    <span>Sign up for free to continue chatting and unlock uploads.</span>
                    <button
                      type="button"
                      onClick={() => setShowSignupModal(true)}
                      className="ml-auto shrink-0 rounded-xl bg-red-300 px-3 py-1.5 text-xs font-semibold text-red-950 transition hover:bg-red-200"
                    >
                      Sign up
                    </button>
                  </div>
                )}
                <ChatComposer
                  autocompleteSuggestions={autocompleteSuggestions}
                  disabled={isLoadingSession || (demo && hasReachedLimit)}
                  isResponding={isLoading}
                  queuedMessages={queuedMessages}
                  queueLimit={QUEUE_LIMIT}
                  onSubmit={handleSubmit}
                  onRemoveQueuedMessage={handleRemoveQueuedMessage}
                  onStopResponse={handleStopResponse}
                  onOpenUpload={demo ? undefined : () => setIsUploadOpen(true)}
                />
                {demo && !hasReachedLimit && (
                  <div className="mx-auto mt-2 flex w-full max-w-5xl items-center justify-between text-xs text-slate-500">
                    <span>Demo mode — {remaining} question{remaining !== 1 ? "s" : ""} remaining</span>
                    <button
                      type="button"
                      onClick={() => setShowSignupModal(true)}
                      className="text-cyan-200 underline transition hover:text-cyan-100"
                    >
                      Sign up for full access
                    </button>
                  </div>
                )}
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
      {isLoading && <RetrievalStatus message={retrievalMessage} />}
      <DemoLimitModal isOpen={showSignupModal} onClose={() => setShowSignupModal(false)} />
    </>
  );

  if (embedded || demo) return chatContent;

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
      onOpenSession={handleOpenSession}
      onNewChat={handleNewChat}
      onOpenUpload={demo ? () => setShowSignupModal(true) : () => setIsUploadOpen(true)}
    >
      {chatContent}
    </AcademicWorkspace>
  );
}
