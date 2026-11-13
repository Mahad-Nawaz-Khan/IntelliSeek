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
  type ChatConversationTurn,
  type ChatMessage as ChatMessageType,
  type ChatResponse,
  type ChatRetrievalHint,
  type ChatSessionSummary,
  type StreamChatHandlers,
} from "../lib/chat-api";
import { usePreferences } from "../lib/preferences";
import {
  createTextStreamSmoother,
  type StreamSmootherResult,
  type TextStreamSmoother,
} from "../lib/stream-smoother";
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

const MAX_TEMPORARY_HISTORY_TURNS = 6;

function toConversationHistory(messages: ChatMessageType[]): ChatConversationTurn[] {
  const turns: ChatConversationTurn[] = [];
  for (let i = 0; i < messages.length - 1; i += 1) {
    const current = messages[i];
    const next = messages[i + 1];
    if (
      current?.role === "user" &&
      next?.role === "assistant" &&
      next.status === "complete" &&
      current.content.trim() &&
      next.content.trim()
    ) {
      turns.push({
        question: current.content.trim(),
        answer: next.content.trim(),
      });
      i += 1;
    }
  }
  return turns.slice(-MAX_TEMPORARY_HISTORY_TURNS);
}

type ChatConversationViewProps = {
  isLoadingSession: boolean;
  messages: ChatMessageType[];
  isLoading: boolean;
  hasPersonalSources: boolean;
  includeKnowledgeBase: boolean;
  isDemo: boolean;
  isTemporaryChat: boolean;
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
  isTemporaryChat,
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
        hasPersonalSources={hasPersonalSources}
        includeKnowledgeBase={includeKnowledgeBase}
        isDemo={isDemo}
        isTemporaryChat={isTemporaryChat}
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
  const [localTemporaryChat, setLocalTemporaryChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<QueuedChatMessage[]>([]);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const isTemporaryChat = !demo && (workspace ? workspace.isTemporaryChat : localTemporaryChat);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const activeSmootherRef = useRef<TextStreamSmoother | null>(null);
  const mountedRef = useRef(true);
  const messagesRef = useRef<ChatMessageType[]>([]);
  const isTemporaryChatRef = useRef(isTemporaryChat);
  const prevSessionParamRef = useRef<string | null>(searchParams.get("session"));
  const queuedMessagesRef = useRef<QueuedChatMessage[]>([]);
  const conversationRunRef = useRef(0);
  const isLoadingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isPinnedToBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const sessionParam = searchParams.get("session");

  const setTemporaryChat = useCallback(
    (next: boolean) => {
      if (demo) return;
      isTemporaryChatRef.current = next;
      if (workspace) {
        workspace.setIsTemporaryChat(next);
      } else {
        setLocalTemporaryChat(next);
      }
    },
    [demo, workspace],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeSmootherRef.current?.stop();
      activeSmootherRef.current = null;
      workspace?.setIsTemporaryChat(false);
    };
  }, [workspace]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isTemporaryChatRef.current = isTemporaryChat;
  }, [isTemporaryChat]);

  useEffect(() => {
    if (!demo && sessionParam && sessionParam !== prevSessionParamRef.current) {
      setTemporaryChat(false);
    }
    prevSessionParamRef.current = sessionParam;
  }, [demo, sessionParam, setTemporaryChat]);

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
  const hasStartedAnswer =
    latestMessage?.role === "assistant" &&
    (Boolean(latestMessage.sources?.length) ||
      Boolean((latestMessage.displayedContent ?? latestMessage.content).length));
  const retrievalMessage =
    isLoading && hasStartedAnswer
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

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el || el.scrollHeight <= el.clientHeight) return;
    if (event.deltaY < 0) {
      isPinnedToBottomRef.current = false;
    }
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    const startY = touchStartYRef.current;
    const currentY = event.touches[0]?.clientY;
    if (!el || el.scrollHeight <= el.clientHeight || startY === null || currentY === undefined) return;
    // Finger moving downward scrolls the viewport upward toward earlier messages.
    if (currentY > startY + 4) {
      isPinnedToBottomRef.current = false;
    }
    touchStartYRef.current = currentY;
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const currentTop = el.scrollTop;
    const previousTop = lastScrollTopRef.current;
    const distanceFromBottom = el.scrollHeight - currentTop - el.clientHeight;
    lastScrollTopRef.current = currentTop;

    // Disengage auto-scroll on any real upward movement so high-frequency streaming
    // frames never yank the viewport back down while the user scrolls up.
    if (currentTop < previousTop - 1 && distanceFromBottom > 2) {
      isPinnedToBottomRef.current = false;
    } else if (currentTop > previousTop + 1 && distanceFromBottom <= 24) {
      isPinnedToBottomRef.current = true;
    }

    setShowScrollToBottom((!isPinnedToBottomRef.current || !preferences.autoScrollOnStream) && distanceFromBottom > 120);
  }, [preferences.autoScrollOnStream]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollContainerRef.current;
    isPinnedToBottomRef.current = true;
    if (el) {
      const targetTop = Math.max(0, el.scrollHeight - el.clientHeight);
      el.scrollTo({ top: targetTop, behavior });
      lastScrollTopRef.current = el.scrollTop;
    } else {
      bottomRef.current?.scrollIntoView({ behavior });
    }
    setShowScrollToBottom(false);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!messages.length) {
      isPinnedToBottomRef.current = true;
      lastScrollTopRef.current = 0;
      setShowScrollToBottom(false);
      return;
    }
    if (!preferences.autoScrollOnStream || !isPinnedToBottomRef.current) {
      if (el) {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollToBottom((!isPinnedToBottomRef.current || !preferences.autoScrollOnStream) && distanceFromBottom > 120);
      }
      return;
    }
    if (el) {
      const targetTop = Math.max(0, el.scrollHeight - el.clientHeight);
      if (Math.abs(el.scrollTop - targetTop) > 1) {
        el.scrollTop = targetTop;
      }
      lastScrollTopRef.current = el.scrollTop;
    } else {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    setShowScrollToBottom(false);
  }, [messages, preferences.autoScrollOnStream]);

  const focusedDocument = workspace?.focusedDocument ?? null;

  const runQuestion = useCallback(
    async (
      question: string,
      selectedSuggestion?: AutocompleteSuggestion,
      runScope = conversationRunRef.current,
      historyOverride?: ChatMessageType[],
    ) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || isLoadingSessionRef.current) return;

      const isTemporaryRun = !demo && isTemporaryChatRef.current;
      const priorMessages = historyOverride ?? messagesRef.current;
      const conversationHistory = isTemporaryRun ? toConversationHistory(priorMessages) : undefined;

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

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      let expectedSessionId = isTemporaryRun ? null : activeSessionIdRef.current;
      let drainPromise: Promise<StreamSmootherResult> | null = null;
      let doneResponse: ChatResponse | null = null;

      const isRunAttached = () =>
        mountedRef.current &&
        conversationRunRef.current === runScope &&
        (isTemporaryRun ? isTemporaryChatRef.current : activeSessionIdRef.current === expectedSessionId);

      const smoother = createTextStreamSmoother({
        onUpdate: (revealed) => {
          if (!isRunAttached()) return;
          setMessages((current) =>
            patchAssistantMessage(current, assistantId, {
              displayedContent: revealed,
              status: "loading",
            }),
          );
        },
        onComplete: (finalText) => {
          if (!isRunAttached()) return;
          setMessages((current) =>
            patchAssistantMessage(current, assistantId, {
              content: finalText,
              displayedContent: undefined,
              ...(doneResponse ? { sources: doneResponse.sources } : {}),
              status: "complete",
            }),
          );
        },
      });
      activeSmootherRef.current = smoother;

      const handleAbort = () => {
        smoother.stop();
      };
      abortController.signal.addEventListener("abort", handleAbort, { once: true });

      const effectiveRetrievalHint: ChatRetrievalHint | undefined =
        selectedSuggestion?.metadata ??
        (focusedDocument
          ? {
              source: "uploaded",
              kind: "document",
              documentId: focusedDocument.id,
            }
          : undefined);

      const streamHandlers: StreamChatHandlers = {
        onJob: demo
          ? undefined
          : (jobId) => {
              if (isRunAttached()) {
                activeJobIdRef.current = jobId;
              }
            },
        onDelta: (text) => {
          smoother.push(text);
        },
        onReset: () => {
          smoother.reset();
          if (!isRunAttached()) return;
          setMessages((current) =>
            patchAssistantMessage(current, assistantId, {
              content: "",
              displayedContent: "",
              status: "loading",
            }),
          );
        },
        onSources: (streamSources) => {
          if (!isRunAttached()) return;
          setMessages((current) =>
            patchAssistantMessage(current, assistantId, { sources: streamSources }),
          );
        },
        onDone: (response) => {
          doneResponse = response;
          const completedSessionId = response.chatSessionId;
          const stillAttached = isRunAttached();

          if (stillAttached) {
            if (!isTemporaryRun && completedSessionId) {
              expectedSessionId = completedSessionId;
              activeSessionIdRef.current = completedSessionId;
              setActiveSessionId(completedSessionId);
              workspace?.setActiveSessionId(completedSessionId);
              loadedSessionRef.current = completedSessionId;
              window.history.replaceState(null, "", `/chat?session=${encodeURIComponent(completedSessionId)}`);
            }
            // Hold status as "loading" until the visual reveal drains so footer actions
            // and source fallback copy appear cleanly after streaming finishes.
            setMessages((current) =>
              patchAssistantMessage(current, assistantId, {
                content: response.answer,
                sources: response.sources,
              }),
            );
            drainPromise = smoother.complete(response.answer);
          } else {
            smoother.stop();
            if (!isTemporaryRun && completedSessionId && loadedSessionRef.current === completedSessionId) {
              loadedSessionRef.current = null;
            }
          }

          if (!demo && !isTemporaryRun) {
            refreshRecentChats().catch(noop);
          }
        },
        onTitle:
          demo || isTemporaryRun
            ? undefined
            : (title) => {
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
      };

      try {
        await (demo
          ? streamChatQuestionDemo(trimmedQuestion, streamHandlers, abortController.signal)
          : streamChatQuestion(trimmedQuestion, streamHandlers, {
              ...(effectiveRetrievalHint ? { retrievalHint: effectiveRetrievalHint } : {}),
              ...(isTemporaryRun
                ? { temporary: true, conversationHistory }
                : expectedSessionId
                  ? { chatSessionId: expectedSessionId }
                  : {}),
              includeKnowledgeBase,
              signal: abortController.signal,
            }));

        if (drainPromise) {
          const drainResult = await (drainPromise as Promise<StreamSmootherResult>);
          if (!drainResult.completed && isRunAttached()) {
            setMessages((current) =>
              patchAssistantMessage(current, assistantId, {
                content: drainResult.text,
                displayedContent: undefined,
                status: "complete",
              }),
            );
          }
        }
      } catch (error) {
        const stoppedText = smoother.stop();
        if (!isRunAttached()) return;

        const isAbort =
          error instanceof DOMException
            ? error.name === "AbortError"
            : error instanceof Error && error.name === "AbortError";

        const resolved = resolveErrorMessage(error, isAbort, stoppedText);
        setMessages((current) =>
          patchAssistantMessage(current, assistantId, {
            content: resolved.content,
            displayedContent: undefined,
            status: resolved.status,
          }),
        );
      } finally {
        abortController.signal.removeEventListener("abort", handleAbort);
        if (activeSmootherRef.current === smoother) {
          activeSmootherRef.current = null;
        }
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
          activeJobIdRef.current = null;
        }

        if (conversationRunRef.current === runScope) {
          setIsLoading(false);
          isLoadingRef.current = false;

          const [nextQueuedMessage, ...remainingQueuedMessages] = queuedMessagesRef.current;
          if (nextQueuedMessage) {
            queuedMessagesRef.current = remainingQueuedMessages;
            setQueuedMessages(remainingQueuedMessages);
            const completedResponse = doneResponse as ChatResponse | null;
            const completedAnswer = completedResponse?.answer.trim();
            const nextHistoryOverride = completedAnswer
              ? [
                  ...priorMessages,
                  userMessage,
                  {
                    ...assistantPlaceholder,
                    content: completedAnswer,
                    sources: completedResponse?.sources,
                    status: "complete" as const,
                  },
                ]
              : priorMessages;
            runQuestion(
              nextQueuedMessage.question,
              nextQueuedMessage.selectedSuggestion,
              runScope,
              nextHistoryOverride,
            ).catch(noop);
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
      const remainingMessages = messages.filter((_, idx) => idx !== assistantIndex && idx !== assistantIndex - 1);
      setMessages(remainingMessages);
      runQuestion(questionToRetry, undefined, conversationRunRef.current, remainingMessages).catch(noop);
    },
    [isLoadingSessionRef, messages, runQuestion],
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

  const resetConversationState = useCallback(
    (options: { temporary: boolean; abortActive: boolean }) => {
      conversationRunRef.current += 1;
      activeSmootherRef.current?.stop();
      activeSmootherRef.current = null;
      if (options.abortActive) {
        const jobId = activeJobIdRef.current;
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        activeJobIdRef.current = null;
        if (jobId && !demo) {
          fetch("/api/chat/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobId }),
          }).catch(noop);
        }
      } else {
        abortControllerRef.current = null;
        activeJobIdRef.current = null;
      }
      setTemporaryChat(options.temporary);
      setIsLoadingSession(false);
      setIsLoading(false);
      isLoadingRef.current = false;
      isLoadingSessionRef.current = false;
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      workspace?.setActiveSessionId(null);
      setMessages([]);
      messagesRef.current = [];
      setQueuedMessages([]);
      queuedMessagesRef.current = [];
      loadedSessionRef.current = null;
      if (!demo) window.history.pushState(null, "", "/chat");
    },
    [
      activeSessionIdRef,
      demo,
      isLoadingSessionRef,
      loadedSessionRef,
      setActiveSessionId,
      setIsLoadingSession,
      setTemporaryChat,
      workspace,
    ],
  );

  const handleNewChat = useCallback(() => {
    resetConversationState({
      temporary: false,
      abortActive: demo || isTemporaryChatRef.current,
    });
  }, [demo, resetConversationState]);

  const handleToggleTemporaryChat = useCallback(() => {
    if (demo) return;
    resetConversationState({
      temporary: !isTemporaryChatRef.current,
      abortActive: isTemporaryChatRef.current,
    });
  }, [demo, resetConversationState]);

  // Listen to sidebar session deletion & New Chat / Temporary Chat events from WorkspaceShell
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
      onToggleTemporaryChat: () => {
        handleToggleTemporaryChat();
      },
    });
  }, [
    activeSessionIdRef,
    demo,
    handleNewChat,
    handleToggleTemporaryChat,
    sessionParam,
    setRecentSessionRows,
    workspace,
  ]);

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

  const isNewChatEmpty = messages.length === 0 && !isLoadingSession;

  const chatContent = (
    <div className={`relative flex min-h-0 flex-1 flex-col ${isNewChatEmpty ? "chat-new-gradient" : ""}`}>
      <ChatHeader
        onOpenUpload={triggerOpenUpload}
        isTemporaryChat={isTemporaryChat}
        onToggleTemporaryChat={demo ? undefined : handleToggleTemporaryChat}
      />
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
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-2 sm:px-6"
          >
            <div className={`flex min-h-full flex-col ${isNewChatEmpty ? "justify-center py-6" : ""}`}>
              <div className={isNewChatEmpty ? "pb-6" : "flex-1 pb-4"}>
                <ChatConversationView
                  isLoadingSession={isLoadingSession}
                  messages={messages}
                  isLoading={isLoading}
                  hasPersonalSources={sources.some(
                    (source) => source.sourceType === "uploaded" && source.status === "indexed",
                  )}
                  includeKnowledgeBase={includeKnowledgeBase}
                  isDemo={demo}
                  isTemporaryChat={isTemporaryChat}
                  onRetryMessage={handleRetryMessage}
                  onOpenUpload={demo ? undefined : triggerOpenUpload}
                  bottomRef={bottomRef}
                />
              </div>

              <div
                className={
                  isNewChatEmpty
                    ? "z-20 -mx-4 px-4 pb-2 pt-1 sm:-mx-6 sm:px-6"
                    : "sticky bottom-0 z-20 -mx-4 px-4 pb-3 pt-2 sm:-mx-6 sm:px-6"
                }
              >
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
                  isTemporaryChat={isTemporaryChat}
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
    </div>
  );

  if (demo) {
    return (
      <div
        style={{ backgroundColor: "var(--chat-workspace-bg, #0a0e22)" }}
        className="chat-workspace-surface flex h-dvh flex-col overflow-hidden bg-[#0a0e22] text-slate-100"
      >
        {chatContent}
      </div>
    );
  }

  if (embedded) return chatContent;

  return (
    <AcademicWorkspace
      groups={sourceGroups}
      recentChats={recentChats}
      sourceStatus={sourceStatus}
      deletingSourceId={deletingSourceId}
      deletingSessionId={deletingSessionId}
      includeKnowledgeBase={includeKnowledgeBase}
      isTemporaryChat={isTemporaryChat}
      onToggleTemporaryChat={handleToggleTemporaryChat}
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
