"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, UploadCloud } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AcademicWorkspace } from "./chat/AcademicWorkspace";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessage } from "./chat/ChatMessage";
import { ChatWelcome } from "./chat/ChatWelcome";
import { useChatDragAndDrop } from "./chat/useChatDragAndDrop";
import { useDocumentUploadToasts } from "./chat/useDocumentUploadToasts";
import { useKnowledgeSources } from "./chat/useKnowledgeSources";
import { useChatSessions } from "./chat/useChatSessions";
import { DemoLimitModal } from "./demo/DemoSignupModal";
import { SUGGESTIONS } from "./SuggestedQueries";
import { RetrievalStatus } from "./sources/RetrievalStatus";
import { IndexingToast } from "./upload/IndexingToast";
import { UploadModal } from "./upload/UploadModal";
import { useWorkspaceOptional } from "./workspace/WorkspaceShell";
import { useAuth } from "../context/AuthContext";
import { useDemo } from "../context/DemoContext";
import {
  streamChatQuestion,
  streamChatQuestionDemo,
  type ChatMessage as ChatMessageType,
  type ChatRetrievalHint,
  type ChatSessionSummary,
} from "../lib/chat-api";
import { usePreferences } from "../lib/preferences";
import type { AutocompleteSuggestion } from "../lib/trie-autocomplete";
import { uploadDocumentFile, type UploadToastPayload } from "../lib/upload-document";
import { createSourceGroups } from "../lib/ui-state";

const noop = () => {};

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

function hasMatchingSession(sessions: ChatSessionSummary[], sessionId: string): boolean {
  return sessions.some((session) => session.id === sessionId);
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
  hasPersonalSources: boolean;
  includeKnowledgeBase: boolean;
  isDemo: boolean;
  onSubmit: (question: string) => boolean;
  onRetryMessage?: (assistantMessageIndex: number) => void;
  onOpenUpload?: () => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
};

function ChatConversationView({
  isLoadingSession,
  messages,
  isLoading,
  hasPersonalSources,
  includeKnowledgeBase,
  isDemo,
  onSubmit,
  onRetryMessage,
  onOpenUpload,
  bottomRef,
}: Readonly<ChatConversationViewProps>) {
  if (isLoadingSession) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 py-10">
        <div className="h-12 w-2/3 max-w-md animate-pulse rounded-3xl bg-white/5" />
        <div className="h-24 w-full max-w-3xl animate-pulse rounded-3xl bg-white/5" />
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <ChatWelcome
        disabled={isLoading}
        hasPersonalSources={hasPersonalSources}
        includeKnowledgeBase={includeKnowledgeBase}
        isDemo={isDemo}
        onSelect={onSubmit}
        onOpenUpload={onOpenUpload}
      />
    );
  }
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {messages.map((message, index) => {
        const canRetry =
          !isLoading &&
          message.role === "assistant" &&
          index > 0 &&
          messages[index - 1]?.role === "user" &&
          Boolean(onRetryMessage);

        return (
          <ChatMessage
            key={message.id}
            message={message}
            onRetry={canRetry ? () => onRetryMessage?.(index) : undefined}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

export function ChatLayout({ embedded = false, demo = false }: Readonly<ChatLayoutProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useAuth();
  const { hasReachedLimit, decrementQuestion, remaining } = useDemo();
  const { preferences, updatePreference } = usePreferences();
  const workspace = useWorkspaceOptional();
  const includeKnowledgeBase = demo ? true : (workspace ? workspace.includeKnowledgeBase : preferences.includeKnowledgeBase);

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<QueuedChatMessage[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const queuedMessagesRef = useRef<QueuedChatMessage[]>([]);
  const conversationRunRef = useRef(0);
  const isLoadingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottomRef = useRef(true);
  const sessionParam = searchParams.get("session");

  useEffect(() => {
    queuedMessagesRef.current = queuedMessages;
  }, [queuedMessages]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Knowledge sources management
  const localKnowledge = useKnowledgeSources({ demo, isLoaded, isSignedIn });
  const sources = workspace && !demo ? workspace.sources : localKnowledge.sources;
  const sourceStatus = workspace && !demo ? workspace.sourceStatus : localKnowledge.sourceStatus;
  const deletingSourceId = workspace && !demo ? workspace.deletingSourceId : localKnowledge.deletingSourceId;
  const handleDeleteSource = workspace && !demo ? workspace.handleDeleteSource : localKnowledge.handleDeleteSource;
  const { setPollDocuments, serverAutocompleteSuggestions } = localKnowledge;

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

  // Upload toasts management
  const { uploadToasts, dismissToast, handleUploadToast: localHandleUploadToast } = useDocumentUploadToasts({
    completedDocumentIds,
    failedDocuments,
    onNewIndexingDocument: useCallback(() => {
      setPollDocuments(true);
      workspace?.refreshSources({ force: true }).catch(noop);
    }, [setPollDocuments, workspace]),
  });

  const handleUploadToast = useCallback(
    (payload: UploadToastPayload) => {
      if (workspace && !demo) {
        workspace.handleUploadToast(payload);
        if (payload.documentId) setPollDocuments(true);
      } else {
        localHandleUploadToast(payload);
      }
    },
    [demo, localHandleUploadToast, setPollDocuments, workspace],
  );

  const handleClearMessages = useCallback(() => {
    setMessages([]);
    setQueuedMessages([]);
    queuedMessagesRef.current = [];
  }, []);

  // Chat sessions management
  const {
    recentSessionRows,
    setRecentSessionRows,
    activeSessionId,
    setActiveSessionId,
    activeSessionIdRef,
    loadedSessionRef,
    isLoadingSession,
    setIsLoadingSession,
    isLoadingSessionRef,
    deletingSessionId,
    refreshRecentChats: localRefreshRecentChats,
    handleOpenSession,
    handleRenameSession,
    handleDeleteSession,
  } = useChatSessions({
    demo,
    isLoaded,
    isSignedIn,
    sessionParam,
    router,
    isLoading,
    onSessionLoaded: setMessages,
    onClearMessages: handleClearMessages,
  });

  const refreshRecentChats = useCallback(async () => {
    await localRefreshRecentChats();
    if (workspace && !demo) {
      await workspace.refreshRecentChats();
    }
  }, [demo, localRefreshRecentChats, workspace]);

  // Keep WorkspaceShell active session in sync with ChatLayout
  useEffect(() => {
    if (!workspace || demo) return;
    workspace.setActiveSessionId(activeSessionId);
  }, [activeSessionId, demo, workspace]);

  const uploadDroppedFiles = useCallback(
    (files: File[]) => {
      if (!files.length || demo) return;

      files.forEach((file) => {
        uploadDocumentFile({
          file,
          userId: user?.id,
          isAuthLoaded: isLoaded,
          isSignedIn,
          toastValidationFailures: true,
          onToast: handleUploadToast,
        }).catch(noop);
      });
    },
    [demo, handleUploadToast, isLoaded, isSignedIn, user],
  );

  const { isChatFileDragging, dragProps } = useChatDragAndDrop(demo, uploadDroppedFiles);

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

  const latestMessage = messages.length ? messages[messages.length - 1] : undefined;
  const retrievalMessage =
    isLoading && latestMessage?.role === "assistant" && latestMessage.sources?.length
      ? "Writing your answer..."
      : includeKnowledgeBase
        ? "Searching your indexed documents..."
        : "Searching your uploaded documents only...";

  const knowledgeBaseDocumentIds = useMemo(
    () => new Set(sources.filter((source) => source.sourceType === "knowledge-base").map((source) => source.id)),
    [sources],
  );

  const knowledgeBaseCount = knowledgeBaseDocumentIds.size;

  const filteredServerAutocompleteSuggestions = useMemo(() => {
    if (includeKnowledgeBase) return serverAutocompleteSuggestions;
    return serverAutocompleteSuggestions.flatMap((suggestion) => {
      const meta = suggestion.metadata;
      if (!meta) return [suggestion];
      if (meta.kind === "document") {
        return knowledgeBaseDocumentIds.has(meta.documentId) ? [] : [suggestion];
      }
      if (meta.kind === "topic") {
        const remainingDocIds = meta.documentIds.filter((id) => !knowledgeBaseDocumentIds.has(id));
        if (!remainingDocIds.length) return [];
        return [{ ...suggestion, metadata: { ...meta, documentIds: remainingDocIds } }];
      }
      return [suggestion];
    });
  }, [includeKnowledgeBase, knowledgeBaseDocumentIds, serverAutocompleteSuggestions]);

  const autocompleteSuggestions = useMemo<AutocompleteSuggestion[]>(() => {
    const promptSuggestions = SUGGESTIONS.map((suggestion) => ({
      id: `prompt-${toAutocompleteId(suggestion)}`,
      label: suggestion,
      value: suggestion,
      type: "prompt" as const,
    }));

    const historySuggestions = messages
      .filter((message) => message.role === "user")
      .slice(-10)
      .map((message) => ({
        id: `history-${message.id}`,
        label: message.content,
        value: message.content,
        type: "history" as const,
        keywords: message.content
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter((t) => t.length >= 2),
      }));

    const seen = new Set<string>();
    return [...promptSuggestions, ...filteredServerAutocompleteSuggestions, ...historySuggestions].filter((suggestion) => {
      const key = `${suggestion.type}:${suggestion.value.toLocaleLowerCase().replace(/\s+/g, " ").trim()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [filteredServerAutocompleteSuggestions, messages]);

  useEffect(() => {
    if (demo) return;
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      conversationRunRef.current += 1;
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      activeJobIdRef.current = null;
      setMessages([]);
      setQueuedMessages([]);
      queuedMessagesRef.current = [];
      router.replace("/sign-in?next=/chat");
    }
  }, [demo, isLoaded, isSignedIn, router, user]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isPinnedToBottomRef.current = distanceFromBottom < 120;
    setShowScrollToBottom(distanceFromBottom > 240);
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      bottomRef.current?.scrollIntoView({ behavior });
    }
    isPinnedToBottomRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  useEffect(() => {
    if (!messages.length) {
      setShowScrollToBottom(false);
      return;
    }
    if (!preferences.autoScrollOnStream || !isPinnedToBottomRef.current) return;
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, preferences.autoScrollOnStream]);

  const focusedDocument = workspace?.focusedDocument ?? null;

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

      isPinnedToBottomRef.current = true;
      setMessages((current) => [...current, userMessage, assistantPlaceholder]);
      setIsLoading(true);
      isLoadingRef.current = true;

      let streamedAnswer = "";
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const sessionAtSend = activeSessionIdRef.current;

      const effectiveRetrievalHint: ChatRetrievalHint | undefined =
        selectedSuggestion?.metadata ??
        (focusedDocument
          ? {
              source: "uploaded",
              kind: "document",
              documentId: focusedDocument.id,
            }
          : undefined);

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
          await streamChatQuestionDemo(
            trimmedQuestion,
            {
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
              onSources: (demoSources) => {
                setMessages((current) =>
                  patchAssistantMessage(current, assistantId, { sources: demoSources }),
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
            },
            abortController.signal,
          );
        } else {
          await streamChatQuestion(
            trimmedQuestion,
            {
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
              onSources: (apiSources) => {
                setMessages((current) =>
                  patchAssistantMessage(current, assistantId, { sources: apiSources }),
                );
              },
              onDone: (response) => {
                const completedSessionId = response.chatSessionId;
                const stillAttached =
                  conversationRunRef.current === runScope && activeSessionIdRef.current === sessionAtSend;

                if (stillAttached) {
                  if (completedSessionId) {
                    activeSessionIdRef.current = completedSessionId;
                    setActiveSessionId(completedSessionId);
                    workspace?.setActiveSessionId(completedSessionId);
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
                  loadedSessionRef.current = null;
                }
                refreshRecentChats().catch(noop);
              },
              onTitle: (title) => {
                const sessionId = activeSessionIdRef.current;
                if (!sessionId) return;
                const applyTitle = (current: ChatSessionSummary[]) => {
                  if (!hasMatchingSession(current, sessionId)) {
                    refreshRecentChats().catch(noop);
                    return current;
                  }
                  return updateSessionTitleInRows(current, sessionId, title);
                };
                setRecentSessionRows(applyTitle);
                workspace?.setRecentSessionRows(applyTitle);
              },
            },
            {
              ...(effectiveRetrievalHint ? { retrievalHint: effectiveRetrievalHint } : {}),
              ...(activeSessionIdRef.current ? { chatSessionId: activeSessionIdRef.current } : {}),
              includeKnowledgeBase,
              signal: abortController.signal,
            },
          );
        }
      } catch (error) {
        const isAbort =
          error instanceof DOMException
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
            runQuestion(nextQueuedMessage.question, nextQueuedMessage.selectedSuggestion, runScope).catch(noop);
          }
        }
      }
    },
    [
      activeSessionIdRef,
      demo,
      focusedDocument,
      includeKnowledgeBase,
      isLoadingSessionRef,
      loadedSessionRef,
      refreshRecentChats,
      setActiveSessionId,
      setRecentSessionRows,
      workspace,
    ],
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
        runQuestion(trimmedQuestion, selectedSuggestion).catch(noop);
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
    [demo, hasReachedLimit, runQuestion, decrementQuestion, isLoadingSessionRef],
  );

  const handleRetryMessage = useCallback(
    (assistantIndex: number) => {
      if (isLoadingRef.current || isLoadingSessionRef.current) return;
      const userMessage = messages[assistantIndex - 1];
      if (!userMessage || userMessage.role !== "user") return;

      const questionToRetry = userMessage.content;
      setMessages((current) => current.filter((_, idx) => idx !== assistantIndex && idx !== assistantIndex - 1));
      runQuestion(questionToRetry).catch(noop);
    },
    [ isLoadingSessionRef, messages, runQuestion],
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
    fetch("/api/chat/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    }).catch(noop);
  }, []);

  const handleNewChat = useCallback(() => {
    conversationRunRef.current += 1;
    if (demo) {
      abortControllerRef.current?.abort();
    } else {
      abortControllerRef.current = null;
      activeJobIdRef.current = null;
    }
    setIsLoadingSession(false);
    setIsLoading(false);
    isLoadingRef.current = false;
    isLoadingSessionRef.current = false;
    setActiveSessionId(null);
    activeSessionIdRef.current = null;
    workspace?.setActiveSessionId(null);
    setMessages([]);
    setQueuedMessages([]);
    queuedMessagesRef.current = [];
    loadedSessionRef.current = null;
    if (!demo) window.history.pushState(null, "", "/chat");
  }, [activeSessionIdRef, demo, loadedSessionRef, isLoadingSessionRef, setActiveSessionId, setIsLoadingSession, workspace]);

  // Listen to sidebar session deletion & New Chat events from WorkspaceShell
  useEffect(() => {
    if (!workspace || demo) return;
    return workspace.registerSessionLifecycle({
      onSessionDeleted: (deletedSessionId) => {
        setRecentSessionRows((current) => current.filter((s) => s.id !== deletedSessionId));
        if (deletedSessionId === activeSessionIdRef.current || deletedSessionId === sessionParam) {
          handleNewChat();
        }
      },
      onNewChat: () => {
        handleNewChat();
      },
    });
  }, [activeSessionIdRef, demo, handleNewChat, sessionParam, setRecentSessionRows, workspace]);

  const handleToggleKnowledgeBase = useCallback(() => {
    if (demo) return;
    if (workspace) {
      workspace.toggleKnowledgeBase();
      return;
    }
    updatePreference("includeKnowledgeBase", !preferences.includeKnowledgeBase);
  }, [demo, preferences.includeKnowledgeBase, updatePreference, workspace]);

  const triggerOpenUpload = useCallback(() => {
    if (demo) {
      setShowSignupModal(true);
      return;
    }
    if (workspace) {
      workspace.openUploadModal("personal");
      return;
    }
    setIsUploadOpen(true);
  }, [demo, workspace]);

  if (!isLoaded || (!demo && (!isSignedIn || !user))) {
    return null;
  }

  const chatContent = (
    <>
      <ChatHeader onOpenUpload={triggerOpenUpload} />
      <div className="relative flex min-h-0 flex-1" {...dragProps}>
        {isChatFileDragging && (
          <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-3xl border-2 border-dashed border-cyan-300/70 bg-slate-950/75 text-cyan-50 shadow-2xl shadow-cyan-950/30 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-100">
                <UploadCloud className="h-7 w-7" />
              </span>
              <span className="text-base font-semibold">Drop files to upload</span>
              <span className="text-xs text-slate-300">
                PDF, DOCX, PPTX, TXT, and MD files upload directly into your sources.
              </span>
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
          >
            <div className="flex min-h-full flex-col">
              <div className="flex-1 pb-6">
                <ChatConversationView
                  isLoadingSession={isLoadingSession}
                  messages={messages}
                  isLoading={isLoading}
                  hasPersonalSources={sources.some(
                    (source) => source.sourceType === "uploaded" && source.status === "indexed",
                  )}
                  includeKnowledgeBase={includeKnowledgeBase}
                  isDemo={demo}
                  onSubmit={handleSubmit}
                  onRetryMessage={handleRetryMessage}
                  onOpenUpload={demo ? undefined : triggerOpenUpload}
                  bottomRef={bottomRef}
                />
              </div>

              <div className="sticky bottom-0 z-20 -mx-4 px-4 pb-6 pt-4 sm:-mx-6 sm:px-6">
                {showScrollToBottom && messages.length > 0 && (
                  <div className="mb-3 flex justify-center">
                    <button
                      type="button"
                      onClick={() => scrollToBottom("smooth")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-slate-950/90 px-3.5 py-1.5 text-xs font-medium text-cyan-100 shadow-lg shadow-cyan-950/30 backdrop-blur-xl transition hover:border-cyan-300/60 hover:bg-slate-900"
                      aria-label="Scroll to latest message"
                    >
                      <ArrowDown className="h-3.5 w-3.5 text-cyan-300" />
                      Jump to latest
                    </button>
                  </div>
                )}

                {demo && hasReachedLimit && (
                  <div className="mx-auto mb-3 flex w-full max-w-4xl items-center gap-2 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-2.5 text-sm text-red-100 shadow-lg">
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
                  focusedDocument={focusedDocument}
                  includeKnowledgeBase={includeKnowledgeBase}
                  knowledgeBaseCount={knowledgeBaseCount}
                  onToggleKnowledgeBase={demo ? undefined : handleToggleKnowledgeBase}
                  onClearFocusedDocument={workspace ? () => workspace.setFocusedDocument(null) : undefined}
                  onSubmit={handleSubmit}
                  onRemoveQueuedMessage={handleRemoveQueuedMessage}
                  onStopResponse={handleStopResponse}
                  onOpenUpload={demo ? undefined : triggerOpenUpload}
                />
                {demo && !hasReachedLimit && (
                  <div className="mx-auto mt-2 flex w-full max-w-4xl items-center justify-between text-xs text-slate-500">
                    <span>
                      Demo mode — {remaining} question{remaining !== 1 ? "s" : ""} remaining
                    </span>
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
      {!workspace && (
        <>
          <UploadModal
            isOpen={isUploadOpen}
            onClose={() => setIsUploadOpen(false)}
            onUploadToast={handleUploadToast}
            completedDocumentIds={completedDocumentIds}
            failedDocuments={failedDocuments}
          />
          <IndexingToast toasts={uploadToasts} onDismiss={dismissToast} />
        </>
      )}
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
      includeKnowledgeBase={includeKnowledgeBase}
      onToggleKnowledgeBase={handleToggleKnowledgeBase}
      onDeleteSource={handleDeleteSource}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
      onOpenSession={handleOpenSession}
      onNewChat={handleNewChat}
      onOpenUpload={triggerOpenUpload}
    >
      {chatContent}
    </AcademicWorkspace>
  );
}
