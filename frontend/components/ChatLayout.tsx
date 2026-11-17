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
import {
  createInitialScrollState,
  evaluateScrollTransition,
  getDistanceFromBottom,
  PROGRAMMATIC_SCROLL_GRACE_MS,
  SCROLL_IDLE_HIDE_DELAY_MS,
  SCROLL_TO_BOTTOM_MIN_DISTANCE_PX,
  type ScrollTrackingState,
} from "../lib/chat-scroll";
import { usePreferences } from "../lib/preferences";
import {
  createTextStreamSmoother,
  type StreamSmootherResult,
  type TextStreamSmoother,
} from "../lib/stream-smoother";
import type { AutocompleteSuggestion } from "../lib/trie-autocomplete";
import { uploadDocumentFile, type UploadToastPayload } from "../lib/upload-document";
import {
  computeSectionSelectionResult,
  computeSourceToggleResult,
  createSourceGroups,
  getSelectedSources,
  hasPersonalUploadedSources,
  isSelectableSource,
  type KnowledgeSource,
  type SourceStatus,
} from "../lib/ui-state";

const noop = () => {};

type ChatLayoutMode = "workspace" | "demo";

type WorkspaceContextValue = ReturnType<typeof useWorkspaceOptional>;

type QueuedChatMessage = {
  id: string;
  question: string;
  selectedSuggestion?: AutocompleteSuggestion;
  scopedDocumentIds?: string[];
  createdAt: number;
};

type TurnRuntimeState = {
  expectedSessionId: string | null;
  drainPromise: Promise<StreamSmootherResult> | null;
  doneResponse: ChatResponse | null;
};

const QUEUE_LIMIT = 3;
const MAX_TEMPORARY_HISTORY_TURNS = 6;

type ChatLayoutProps = {
  embedded?: boolean;
};

type ChatLayoutCoreProps = {
  mode: ChatLayoutMode;
  embedded: boolean;
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

function removeSessionById(sessionId: string) {
  return (current: ChatSessionSummary[]) => current.filter((session) => session.id !== sessionId);
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError";
  }
  return error instanceof Error && error.name === "AbortError";
}

function toTurnFailureMessage(
  error: unknown,
  streamedAnswer: string,
): { content: string; status: "complete" | "error" } {
  if (isAbortError(error)) {
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

function toConversationHistory(messages: ChatMessageType[]): ChatConversationTurn[] {
  const turns: ChatConversationTurn[] = [];
  let index = 0;
  while (index < messages.length - 1) {
    const current = messages[index];
    const next = messages[index + 1];
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
      index += 2;
    } else {
      index += 1;
    }
  }
  return turns.slice(-MAX_TEMPORARY_HISTORY_TURNS);
}

function isAuthorizedToRenderChat(
  mode: ChatLayoutMode,
  isLoaded: boolean,
  isSignedIn: boolean,
  hasUser: boolean,
): boolean {
  if (!isLoaded) return false;
  if (mode === "demo") return true;
  return isSignedIn && hasUser;
}

function resolveWorkspaceSourceBindings(
  isDemoMode: boolean,
  workspace: WorkspaceContextValue,
  localKnowledge: ReturnType<typeof useKnowledgeSources>,
) {
  if (workspace && !isDemoMode) {
    return {
      sources: workspace.sources,
      sourceStatus: workspace.sourceStatus,
      deletingSourceId: workspace.deletingSourceId,
      handleDeleteSource: workspace.handleDeleteSource,
    };
  }
  return {
    sources: localKnowledge.sources,
    sourceStatus: localKnowledge.sourceStatus,
    deletingSourceId: localKnowledge.deletingSourceId,
    handleDeleteSource: localKnowledge.handleDeleteSource,
  };
}

function buildRecentChatItems(recentSessionRows: ChatSessionSummary[], activeSessionId: string | null) {
  return recentSessionRows.map((session) => ({
    id: session.id,
    title: session.title || "New chat",
    status: session.id === activeSessionId ? ("active" as const) : ("inactive" as const),
  }));
}

function hasAssistantStartedAnswer(messages: ChatMessageType[]): boolean {
  const latestMessage = messages.at(-1);
  if (latestMessage?.role !== "assistant") return false;
  if (latestMessage.sources?.length) return true;
  return Boolean((latestMessage.displayedContent ?? latestMessage.content).length);
}

function resolveIncludeKnowledgeBase(
  mode: ChatLayoutMode,
  workspace: WorkspaceContextValue,
  preferenceValue: boolean,
): boolean {
  if (mode === "demo") {
    return true;
  }
  return workspace ? workspace.includeKnowledgeBase : preferenceValue;
}

function getRetrievalStatusMessage({
  isLoading,
  hasStartedAnswer,
  includeKnowledgeBase,
}: Readonly<{
  isLoading: boolean;
  hasStartedAnswer: boolean;
  includeKnowledgeBase: boolean;
}>): string {
  if (isLoading && hasStartedAnswer) {
    return "Writing your answer...";
  }
  return includeKnowledgeBase
    ? "Searching your indexed documents..."
    : "Searching your uploaded documents only...";
}

function resolveRetrievalHint(
  selectedSuggestion: AutocompleteSuggestion | undefined,
  scopedDocumentIds: string[] | undefined,
  focusedDocument: { id: string } | null,
): ChatRetrievalHint | undefined {
  if (selectedSuggestion?.metadata) {
    return selectedSuggestion.metadata;
  }
  if (scopedDocumentIds?.length === 1) {
    return {
      source: "uploaded",
      kind: "document",
      documentId: scopedDocumentIds[0],
    };
  }
  if (focusedDocument) {
    return {
      source: "uploaded",
      kind: "document",
      documentId: focusedDocument.id,
    };
  }
  return undefined;
}

function resolveTurnIncludeKnowledgeBase(
  includeKnowledgeBase: boolean,
  scopedDocumentIds: string[] | undefined,
  knowledgeBaseDocumentIds: Set<string>,
): boolean {
  if (!scopedDocumentIds?.length || includeKnowledgeBase) {
    return includeKnowledgeBase;
  }
  return scopedDocumentIds.some((id) => knowledgeBaseDocumentIds.has(id));
}

type BuildStreamOptionsInput = {
  retrievalHint?: ChatRetrievalHint;
  isTemporaryRun: boolean;
  conversationHistory?: ChatConversationTurn[];
  expectedSessionId: string | null;
  includeKnowledgeBase: boolean;
  scopedDocumentIds?: string[];
  hasExcludedSources: boolean;
  selectedSourceIds: string[];
  signal: AbortSignal;
};

function buildStreamRequestOptions({
  retrievalHint,
  isTemporaryRun,
  conversationHistory,
  expectedSessionId,
  includeKnowledgeBase,
  scopedDocumentIds,
  hasExcludedSources,
  selectedSourceIds,
  signal,
}: BuildStreamOptionsInput) {
  const options: Parameters<typeof streamChatQuestion>[2] = {
    includeKnowledgeBase,
    signal,
  };
  if (retrievalHint) {
    options.retrievalHint = retrievalHint;
  }
  if (isTemporaryRun) {
    options.temporary = true;
    options.conversationHistory = conversationHistory;
  } else if (expectedSessionId) {
    options.chatSessionId = expectedSessionId;
  }
  if (scopedDocumentIds?.length) {
    options.selectedDocumentIds = scopedDocumentIds;
  } else if (hasExcludedSources) {
    options.selectedDocumentIds = selectedSourceIds;
  }
  return options;
}

function filterSingleSuggestionForScope(
  suggestion: AutocompleteSuggestion,
  knowledgeBaseDocumentIds: Set<string>,
): AutocompleteSuggestion[] {
  const meta = suggestion.metadata;
  if (!meta) return [suggestion];
  if (meta.kind === "document") {
    return knowledgeBaseDocumentIds.has(meta.documentId) ? [] : [suggestion];
  }
  if (meta.kind !== "topic") {
    return [suggestion];
  }
  const remainingDocIds = meta.documentIds.filter((id) => !knowledgeBaseDocumentIds.has(id));
  if (!remainingDocIds.length) return [];
  return [{ ...suggestion, metadata: { ...meta, documentIds: remainingDocIds } }];
}

function filterSuggestionsForScope(
  suggestions: AutocompleteSuggestion[],
  includeKnowledgeBase: boolean,
  knowledgeBaseDocumentIds: Set<string>,
): AutocompleteSuggestion[] {
  if (includeKnowledgeBase) return suggestions;
  return suggestions.flatMap((suggestion) =>
    filterSingleSuggestionForScope(suggestion, knowledgeBaseDocumentIds),
  );
}

function buildCombinedAutocompleteSuggestions(
  filteredServerSuggestions: AutocompleteSuggestion[],
  messages: ChatMessageType[],
): AutocompleteSuggestion[] {
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
  return [...promptSuggestions, ...filteredServerSuggestions, ...historySuggestions].filter((suggestion) => {
    const key = `${suggestion.type}:${suggestion.value.toLocaleLowerCase().replace(/\s+/g, " ").trim()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cancelServerChatJob(jobId: string | null) {
  if (!jobId) return;
  fetch("/api/chat/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  }).catch(noop);
}

function tryEnqueueSubmittedQuestion(params: {
  question: string;
  selectedSuggestion?: AutocompleteSuggestion;
  scopedDocumentIds?: string[];
  queuedMessagesRef: React.MutableRefObject<QueuedChatMessage[]>;
  setQueuedMessages: (messages: QueuedChatMessage[]) => void;
}): boolean {
  if (params.queuedMessagesRef.current.length >= QUEUE_LIMIT) return false;

  const queuedMessage: QueuedChatMessage = {
    id: `queued-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    question: params.question,
    selectedSuggestion: params.selectedSuggestion,
    ...(params.scopedDocumentIds?.length ? { scopedDocumentIds: params.scopedDocumentIds } : {}),
    createdAt: Date.now(),
  };

  const nextQueuedMessages = [...params.queuedMessagesRef.current, queuedMessage];
  params.queuedMessagesRef.current = nextQueuedMessages;
  params.setQueuedMessages(nextQueuedMessages);
  return true;
}

function createTurnPlaceholderMessages(trimmedQuestion: string) {
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
  return { userMessage, assistantId, assistantPlaceholder };
}

function createTurnSmoother(
  assistantId: string,
  isRunAttached: () => boolean,
  turnState: TurnRuntimeState,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>,
): TextStreamSmoother {
  return createTextStreamSmoother({
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
          ...(turnState.doneResponse ? { sources: turnState.doneResponse.sources } : {}),
          status: "complete",
        }),
      );
    },
  });
}

function applyTitleUpdateToRows(
  rows: ChatSessionSummary[],
  sessionId: string,
  title: string,
  refreshRecentChats: () => Promise<void>,
): ChatSessionSummary[] {
  if (!hasMatchingSession(rows, sessionId)) {
    refreshRecentChats().catch(noop);
    return rows;
  }
  return updateSessionTitleInRows(rows, sessionId, title);
}

type TurnHandlerContext = {
  mode: ChatLayoutMode;
  assistantId: string;
  isTemporaryRun: boolean;
  isRunAttached: () => boolean;
  turnState: TurnRuntimeState;
  smoother: TextStreamSmoother;
  activeJobIdRef: React.MutableRefObject<string | null>;
  activeSessionIdRef: React.MutableRefObject<string | null>;
  loadedSessionRef: React.MutableRefObject<string | null>;
  workspace: WorkspaceContextValue;
  setActiveSessionId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  setRecentSessionRows: React.Dispatch<React.SetStateAction<ChatSessionSummary[]>>;
  refreshRecentChats: () => Promise<void>;
};

function handleCompletedTurnResponse(ctx: TurnHandlerContext, response: ChatResponse) {
  ctx.turnState.doneResponse = response;
  const completedSessionId = response.chatSessionId;

  if (ctx.isRunAttached()) {
    if (!ctx.isTemporaryRun && completedSessionId) {
      ctx.turnState.expectedSessionId = completedSessionId;
      ctx.activeSessionIdRef.current = completedSessionId;
      ctx.setActiveSessionId(completedSessionId);
      ctx.workspace?.setActiveSessionId(completedSessionId);
      ctx.loadedSessionRef.current = completedSessionId;
      window.history.replaceState(null, "", `/chat?session=${encodeURIComponent(completedSessionId)}`);
    }
    // Hold status as "loading" until the visual reveal drains so footer actions
    // and source fallback copy appear cleanly after streaming finishes.
    ctx.setMessages((current) =>
      patchAssistantMessage(current, ctx.assistantId, {
        content: response.answer,
        sources: response.sources,
      }),
    );
    ctx.turnState.drainPromise = ctx.smoother.complete(response.answer);
  } else {
    ctx.smoother.stop();
    if (!ctx.isTemporaryRun && completedSessionId && ctx.loadedSessionRef.current === completedSessionId) {
      ctx.loadedSessionRef.current = null;
    }
  }

  if (ctx.mode !== "demo" && !ctx.isTemporaryRun) {
    ctx.refreshRecentChats().catch(noop);
  }
}

function createTitleHandler(ctx: TurnHandlerContext): ((title: string) => void) | undefined {
  if (ctx.mode === "demo" || ctx.isTemporaryRun) {
    return undefined;
  }
  return (title: string) => {
    const sessionId = ctx.activeSessionIdRef.current;
    if (!sessionId) return;
    const applyTitle = (current: ChatSessionSummary[]) =>
      applyTitleUpdateToRows(current, sessionId, title, ctx.refreshRecentChats);
    ctx.setRecentSessionRows(applyTitle);
    ctx.workspace?.setRecentSessionRows(applyTitle);
  };
}

function createTurnStreamHandlers(ctx: TurnHandlerContext): StreamChatHandlers {
  return {
    onJob:
      ctx.mode === "demo"
        ? undefined
        : (jobId) => {
            if (ctx.isRunAttached()) {
              ctx.activeJobIdRef.current = jobId;
            }
          },
    onDelta: (text) => {
      ctx.smoother.push(text);
    },
    onReset: () => {
      ctx.smoother.reset();
      if (!ctx.isRunAttached()) return;
      ctx.setMessages((current) =>
        patchAssistantMessage(current, ctx.assistantId, {
          content: "",
          displayedContent: "",
          status: "loading",
        }),
      );
    },
    onSources: (streamSources) => {
      if (!ctx.isRunAttached()) return;
      ctx.setMessages((current) =>
        patchAssistantMessage(current, ctx.assistantId, { sources: streamSources }),
      );
    },
    onDone: (response) => handleCompletedTurnResponse(ctx, response),
    onTitle: createTitleHandler(ctx),
  };
}

function buildNextQueuedHistory(
  priorMessages: ChatMessageType[],
  userMessage: ChatMessageType,
  assistantPlaceholder: ChatMessageType,
  doneResponse: ChatResponse | null,
): ChatMessageType[] {
  const completedAnswer = doneResponse?.answer.trim();
  if (!completedAnswer) {
    return priorMessages;
  }
  return [
    ...priorMessages,
    userMessage,
    {
      ...assistantPlaceholder,
      content: completedAnswer,
      sources: doneResponse?.sources,
      status: "complete" as const,
    },
  ];
}

async function executeStreamTurn(params: {
  mode: ChatLayoutMode;
  trimmedQuestion: string;
  streamHandlers: StreamChatHandlers;
  requestOptions: Parameters<typeof streamChatQuestion>[2];
  abortSignal: AbortSignal;
  smoother: TextStreamSmoother;
  turnState: TurnRuntimeState;
  isRunAttached: () => boolean;
  assistantId: string;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
}) {
  try {
    if (params.mode === "demo") {
      await streamChatQuestionDemo(params.trimmedQuestion, params.streamHandlers, params.abortSignal);
    } else {
      await streamChatQuestion(params.trimmedQuestion, params.streamHandlers, params.requestOptions);
    }

    if (params.turnState.drainPromise) {
      const drainResult = await params.turnState.drainPromise;
      if (!drainResult.completed && params.isRunAttached()) {
        params.setMessages((current) =>
          patchAssistantMessage(current, params.assistantId, {
            content: drainResult.text,
            displayedContent: undefined,
            status: "complete",
          }),
        );
      }
    }
  } catch (error) {
    const stoppedText = params.smoother.stop();
    if (!params.isRunAttached()) return;

    const resolved = toTurnFailureMessage(error, stoppedText);
    params.setMessages((current) =>
      patchAssistantMessage(current, params.assistantId, {
        content: resolved.content,
        displayedContent: undefined,
        status: resolved.status,
      }),
    );
  }
}

type FinalizeQuestionTurnParams = {
  abortSignal: AbortSignal;
  handleAbort: () => void;
  smoother: TextStreamSmoother;
  abortController: AbortController;
  activeSmootherRef: React.MutableRefObject<TextStreamSmoother | null>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  activeJobIdRef: React.MutableRefObject<string | null>;
  conversationRunRef: React.MutableRefObject<number>;
  runScope: number;
  setIsLoading: (loading: boolean) => void;
  isLoadingRef: React.MutableRefObject<boolean>;
  queuedMessagesRef: React.MutableRefObject<QueuedChatMessage[]>;
  setQueuedMessages: (messages: QueuedChatMessage[]) => void;
  priorMessages: ChatMessageType[];
  userMessage: ChatMessageType;
  assistantPlaceholder: ChatMessageType;
  doneResponse: ChatResponse | null;
  onDispatchNext: (
    question: string,
    selectedSuggestion: AutocompleteSuggestion | undefined,
    runScope: number,
    historyOverride: ChatMessageType[],
    scopedDocumentIds?: string[],
  ) => Promise<void>;
};

function finalizeQuestionTurn(params: FinalizeQuestionTurnParams) {
  params.abortSignal.removeEventListener("abort", params.handleAbort);
  if (params.activeSmootherRef.current === params.smoother) {
    params.activeSmootherRef.current = null;
  }
  if (params.abortControllerRef.current === params.abortController) {
    params.abortControllerRef.current = null;
    params.activeJobIdRef.current = null;
  }

  if (params.conversationRunRef.current !== params.runScope) return;
  params.setIsLoading(false);
  params.isLoadingRef.current = false;

  const [nextQueuedMessage, ...remainingQueuedMessages] = params.queuedMessagesRef.current;
  if (!nextQueuedMessage) return;

  params.queuedMessagesRef.current = remainingQueuedMessages;
  params.setQueuedMessages(remainingQueuedMessages);
  const nextHistoryOverride = buildNextQueuedHistory(
    params.priorMessages,
    params.userMessage,
    params.assistantPlaceholder,
    params.doneResponse,
  );
  params
    .onDispatchNext(
      nextQueuedMessage.question,
      nextQueuedMessage.selectedSuggestion,
      params.runScope,
      nextHistoryOverride,
      nextQueuedMessage.scopedDocumentIds,
    )
    .catch(noop);
}

function scrollElementImmediatelyToBottom(el: HTMLDivElement, scrollStateRef: React.MutableRefObject<ScrollTrackingState>) {
  const targetTop = Math.max(0, el.scrollHeight - el.clientHeight);
  if (Math.abs(el.scrollTop - targetTop) > 1) {
    el.scrollTop = targetTop;
  }
  scrollStateRef.current.lastScrollTop = el.scrollTop;
  scrollStateRef.current.downwardScrollDistance = 0;
}

function performScrollContainerToBottom(
  el: HTMLDivElement | null,
  bottomRef: React.RefObject<HTMLDivElement | null>,
  behavior: ScrollBehavior,
  scrollStateRef: React.MutableRefObject<ScrollTrackingState>,
) {
  if (el) {
    const targetTop = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTo({ top: targetTop, behavior });
    scrollStateRef.current.lastScrollTop = el.scrollTop;
    return;
  }
  bottomRef.current?.scrollIntoView({ behavior });
}

function clearWindowTimer(timerRef: React.MutableRefObject<number | null>) {
  if (timerRef.current === null) return;
  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}

function cancelAutoScrollOnUpIntent(params: {
  scrollStateRef: React.MutableRefObject<ScrollTrackingState>;
  programmaticTimerRef: React.MutableRefObject<number | null>;
  hideScrollButton: () => void;
}) {
  params.scrollStateRef.current.isPinnedToBottom = false;
  params.scrollStateRef.current.isProgrammaticScrollToBottom = false;
  clearWindowTimer(params.programmaticTimerRef);
  params.hideScrollButton();
}

function attachProgrammaticScrollEndListener(
  el: HTMLDivElement | null,
  scrollStateRef: React.MutableRefObject<ScrollTrackingState>,
  programmaticTimerRef: React.MutableRefObject<number | null>,
) {
  const finishProgrammatic = () => {
    scrollStateRef.current.isProgrammaticScrollToBottom = false;
    clearWindowTimer(programmaticTimerRef);
  };
  el?.addEventListener("scrollend", finishProgrammatic, { once: true });
  programmaticTimerRef.current = window.setTimeout(() => {
    el?.removeEventListener("scrollend", finishProgrammatic);
    finishProgrammatic();
  }, PROGRAMMATIC_SCROLL_GRACE_MS);
}

function syncScrollOnMessagesUpdate(params: {
  el: HTMLDivElement | null;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  messagesLength: number;
  autoScrollOnStream: boolean;
  scrollStateRef: React.MutableRefObject<ScrollTrackingState>;
  programmaticTimerRef: React.MutableRefObject<number | null>;
  hideScrollButton: () => void;
}) {
  if (!params.messagesLength) {
    params.scrollStateRef.current = createInitialScrollState();
    clearWindowTimer(params.programmaticTimerRef);
    params.hideScrollButton();
    return;
  }
  if (!params.autoScrollOnStream || !params.scrollStateRef.current.isPinnedToBottom) {
    if (!params.el) return;
    const distanceFromBottom = getDistanceFromBottom({
      currentTop: params.el.scrollTop,
      scrollHeight: params.el.scrollHeight,
      clientHeight: params.el.clientHeight,
    });
    if (distanceFromBottom <= SCROLL_TO_BOTTOM_MIN_DISTANCE_PX) {
      params.hideScrollButton();
    }
    return;
  }
  if (params.el) {
    scrollElementImmediatelyToBottom(params.el, params.scrollStateRef);
  } else {
    params.bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }
  params.hideScrollButton();
}

function processScrollContainerEvent(params: {
  el: HTMLDivElement | null;
  scrollStateRef: React.MutableRefObject<ScrollTrackingState>;
  programmaticTimerRef: React.MutableRefObject<number | null>;
  hideScrollButton: () => void;
  showScrollButtonAndScheduleHide: () => void;
}) {
  if (!params.el) return;
  const { nextState, action } = evaluateScrollTransition(params.scrollStateRef.current, {
    currentTop: params.el.scrollTop,
    scrollHeight: params.el.scrollHeight,
    clientHeight: params.el.clientHeight,
  });
  params.scrollStateRef.current = nextState;

  if (!nextState.isProgrammaticScrollToBottom) {
    clearWindowTimer(params.programmaticTimerRef);
  }
  if (action === "hide") {
    params.hideScrollButton();
  } else if (action === "show") {
    params.showScrollButtonAndScheduleHide();
  }
}

function handleWheelScrollIntent(params: {
  el: HTMLDivElement | null;
  deltaY: number;
  scrollStateRef: React.MutableRefObject<ScrollTrackingState>;
  programmaticTimerRef: React.MutableRefObject<number | null>;
  hideScrollButton: () => void;
}) {
  if (!params.el || params.el.scrollHeight <= params.el.clientHeight || params.deltaY >= 0) return;
  cancelAutoScrollOnUpIntent(params);
}

function handleTouchMoveScrollIntent(params: {
  el: HTMLDivElement | null;
  touchStartYRef: React.MutableRefObject<number | null>;
  currentY: number | undefined;
  scrollStateRef: React.MutableRefObject<ScrollTrackingState>;
  programmaticTimerRef: React.MutableRefObject<number | null>;
  hideScrollButton: () => void;
}) {
  const startY = params.touchStartYRef.current;
  if (!params.el || params.el.scrollHeight <= params.el.clientHeight || startY === null || params.currentY === undefined) {
    return;
  }
  // Finger moving downward scrolls the viewport upward toward earlier messages.
  if (params.currentY > startY + 4) {
    cancelAutoScrollOnUpIntent(params);
  }
  params.touchStartYRef.current = params.currentY;
}

function executeScrollToBottom(params: {
  el: HTMLDivElement | null;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  behavior: ScrollBehavior;
  isInteractingWithButtonRef: React.MutableRefObject<boolean>;
  scrollStateRef: React.MutableRefObject<ScrollTrackingState>;
  programmaticTimerRef: React.MutableRefObject<number | null>;
  hideScrollButton: () => void;
}) {
  const isSmooth = params.behavior === "smooth";
  params.isInteractingWithButtonRef.current = false;
  params.scrollStateRef.current = {
    ...params.scrollStateRef.current,
    isPinnedToBottom: true,
    downwardScrollDistance: 0,
    isProgrammaticScrollToBottom: isSmooth,
  };
  params.hideScrollButton();
  performScrollContainerToBottom(params.el, params.bottomRef, params.behavior, params.scrollStateRef);
  clearWindowTimer(params.programmaticTimerRef);
  if (isSmooth) {
    attachProgrammaticScrollEndListener(params.el, params.scrollStateRef, params.programmaticTimerRef);
  }
}

function useChatScrollTracking(messages: ChatMessageType[], autoScrollOnStream: boolean) {
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollStateRef = useRef<ScrollTrackingState>(createInitialScrollState());
  const touchStartYRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const programmaticTimerRef = useRef<number | null>(null);
  const isInteractingWithButtonRef = useRef(false);
  const showScrollToBottomRef = useRef(false);

  const setButtonVisible = useCallback((visible: boolean) => {
    showScrollToBottomRef.current = visible;
    setShowScrollToBottom((current) => (current === visible ? current : visible));
  }, []);

  const hideScrollButton = useCallback(() => {
    clearWindowTimer(hideTimerRef);
    scrollStateRef.current.downwardScrollDistance = 0;
    setButtonVisible(false);
  }, [setButtonVisible]);

  const scheduleIdleHide = useCallback(() => {
    clearWindowTimer(hideTimerRef);
    if (isInteractingWithButtonRef.current) return;
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      scrollStateRef.current.downwardScrollDistance = 0;
      setButtonVisible(false);
    }, SCROLL_IDLE_HIDE_DELAY_MS);
  }, [setButtonVisible]);

  const showScrollButtonAndScheduleHide = useCallback(() => {
    setButtonVisible(true);
    scheduleIdleHide();
  }, [scheduleIdleHide, setButtonVisible]);

  useEffect(() => {
    return () => {
      clearWindowTimer(hideTimerRef);
      clearWindowTimer(programmaticTimerRef);
    };
  }, []);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      handleWheelScrollIntent({
        el: scrollContainerRef.current,
        deltaY: event.deltaY,
        scrollStateRef,
        programmaticTimerRef,
        hideScrollButton,
      });
    },
    [hideScrollButton],
  );

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, []);

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      handleTouchMoveScrollIntent({
        el: scrollContainerRef.current,
        touchStartYRef,
        currentY: event.touches[0]?.clientY,
        scrollStateRef,
        programmaticTimerRef,
        hideScrollButton,
      });
    },
    [hideScrollButton],
  );

  const handleScroll = useCallback(() => {
    processScrollContainerEvent({
      el: scrollContainerRef.current,
      scrollStateRef,
      programmaticTimerRef,
      hideScrollButton,
      showScrollButtonAndScheduleHide,
    });
  }, [hideScrollButton, showScrollButtonAndScheduleHide]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      executeScrollToBottom({
        el: scrollContainerRef.current,
        bottomRef,
        behavior,
        isInteractingWithButtonRef,
        scrollStateRef,
        programmaticTimerRef,
        hideScrollButton,
      });
    },
    [hideScrollButton],
  );

  const startScrollButtonInteraction = useCallback(() => {
    isInteractingWithButtonRef.current = true;
    clearWindowTimer(hideTimerRef);
  }, []);

  const endScrollButtonInteraction = useCallback(() => {
    isInteractingWithButtonRef.current = false;
    if (showScrollToBottomRef.current && !scrollStateRef.current.isProgrammaticScrollToBottom) {
      scheduleIdleHide();
    }
  }, [scheduleIdleHide]);

  const pinToBottomForNewTurn = useCallback(() => {
    scrollStateRef.current.isPinnedToBottom = true;
    scrollStateRef.current.isProgrammaticScrollToBottom = false;
    clearWindowTimer(programmaticTimerRef);
    hideScrollButton();
  }, [hideScrollButton]);

  useEffect(() => {
    syncScrollOnMessagesUpdate({
      el: scrollContainerRef.current,
      bottomRef,
      messagesLength: messages.length,
      autoScrollOnStream,
      scrollStateRef,
      programmaticTimerRef,
      hideScrollButton,
    });
  }, [messages, autoScrollOnStream, hideScrollButton]);

  return {
    bottomRef,
    scrollContainerRef,
    showScrollToBottom,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleScroll,
    scrollToBottom,
    startScrollButtonInteraction,
    endScrollButtonInteraction,
    pinToBottomForNewTurn,
  };
}

function computeSelectAllLocalSourceIds(sources: KnowledgeSource[], selected: boolean): string[] {
  if (selected) return [];
  return sources.filter(isSelectableSource).map((item) => item.id);
}

function shouldEnableKbForSelectAll(
  sources: KnowledgeSource[],
  selected: boolean,
  includeKnowledgeBase: boolean,
): boolean {
  if (!selected || includeKnowledgeBase) return false;
  return sources.some((item) => item.sourceType === "knowledge-base" && isSelectableSource(item));
}

function resolveExcludedSourceIdsForMode(
  mode: ChatLayoutMode,
  workspace: WorkspaceContextValue,
  localExcludedSourceIds: string[],
): string[] {
  if (mode !== "demo" && workspace) return workspace.excludedSourceIds;
  return localExcludedSourceIds;
}

function resolveSelectedSourceIdsForMode(params: {
  mode: ChatLayoutMode;
  workspace: WorkspaceContextValue;
  sources: KnowledgeSource[];
  localExcludedSourceIds: string[];
  includeKnowledgeBase: boolean;
}): string[] {
  if (params.mode !== "demo" && params.workspace) {
    return params.workspace.selectedSourceIds;
  }
  return getSelectedSources(params.sources, params.localExcludedSourceIds, params.includeKnowledgeBase).map(
    (source) => source.id,
  );
}

function useSourceIdSets(sources: KnowledgeSource[]) {
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
  const knowledgeBaseDocumentIds = useMemo(
    () => new Set(sources.filter((source) => source.sourceType === "knowledge-base").map((source) => source.id)),
    [sources],
  );
  const selectableSourceIds = useMemo(
    () => new Set(sources.filter(isSelectableSource).map((source) => source.id)),
    [sources],
  );

  return {
    completedDocumentIds,
    failedDocuments,
    knowledgeBaseDocumentIds,
    selectableSourceIds,
  };
}

function applyKnowledgeBaseToggle(
  mode: ChatLayoutMode,
  workspace: WorkspaceContextValue,
  includeKnowledgeBase: boolean,
  updatePreference: (key: "includeKnowledgeBase", value: boolean) => void,
) {
  if (mode === "demo") return;
  if (workspace) {
    workspace.toggleKnowledgeBase();
    return;
  }
  updatePreference("includeKnowledgeBase", !includeKnowledgeBase);
}

function applySourceSelectionToggle(params: {
  mode: ChatLayoutMode;
  workspace: WorkspaceContextValue;
  sources: KnowledgeSource[];
  localExcludedSourceIds: string[];
  sourceId: string;
  includeKnowledgeBase: boolean;
  setLocalExcludedSourceIds: (ids: string[]) => void;
  updatePreference: (key: "includeKnowledgeBase", value: boolean) => void;
}) {
  if (params.mode === "demo") return;
  if (params.workspace) {
    params.workspace.toggleSourceSelection(params.sourceId);
    return;
  }
  const result = computeSourceToggleResult(
    params.sources,
    params.localExcludedSourceIds,
    params.sourceId,
    params.includeKnowledgeBase,
  );
  params.setLocalExcludedSourceIds(result.excludedSourceIds);
  if (result.enableKnowledgeBase) {
    params.updatePreference("includeKnowledgeBase", true);
  }
}

function applySectionSourcesToggle(params: {
  mode: ChatLayoutMode;
  workspace: WorkspaceContextValue;
  sources: KnowledgeSource[];
  localExcludedSourceIds: string[];
  sourceType: KnowledgeSource["sourceType"];
  selected: boolean;
  includeKnowledgeBase: boolean;
  setLocalExcludedSourceIds: (ids: string[]) => void;
  updatePreference: (key: "includeKnowledgeBase", value: boolean) => void;
}) {
  if (params.mode === "demo") return;
  if (params.workspace) {
    params.workspace.setSectionSourcesSelected(params.sourceType, params.selected);
    return;
  }
  const result = computeSectionSelectionResult(
    params.sources,
    params.localExcludedSourceIds,
    params.sourceType,
    params.selected,
    params.includeKnowledgeBase,
  );
  params.setLocalExcludedSourceIds(result.excludedSourceIds);
  if (result.enableKnowledgeBase) {
    params.updatePreference("includeKnowledgeBase", true);
  }
}

function applyAllSourcesToggle(params: {
  mode: ChatLayoutMode;
  workspace: WorkspaceContextValue;
  sources: KnowledgeSource[];
  selected: boolean;
  includeKnowledgeBase: boolean;
  setLocalExcludedSourceIds: (ids: string[]) => void;
  updatePreference: (key: "includeKnowledgeBase", value: boolean) => void;
}) {
  if (params.mode === "demo") return;
  if (params.workspace) {
    params.workspace.setAllSourcesSelected(params.selected);
    return;
  }
  params.setLocalExcludedSourceIds(computeSelectAllLocalSourceIds(params.sources, params.selected));
  if (shouldEnableKbForSelectAll(params.sources, params.selected, params.includeKnowledgeBase)) {
    params.updatePreference("includeKnowledgeBase", true);
  }
}

function useChatSourceControls(params: {
  mode: ChatLayoutMode;
  workspace: WorkspaceContextValue;
  sources: KnowledgeSource[];
  includeKnowledgeBase: boolean;
  updatePreference: (key: "includeKnowledgeBase", value: boolean) => void;
}) {
  const { mode, workspace, sources, includeKnowledgeBase, updatePreference } = params;
  const [localExcludedSourceIds, setLocalExcludedSourceIds] = useState<string[]>([]);
  const { completedDocumentIds, failedDocuments, knowledgeBaseDocumentIds, selectableSourceIds } =
    useSourceIdSets(sources);

  const excludedSourceIds = resolveExcludedSourceIdsForMode(mode, workspace, localExcludedSourceIds);
  const selectedSourceIds = useMemo(
    () =>
      resolveSelectedSourceIdsForMode({
        mode,
        workspace,
        sources,
        localExcludedSourceIds,
        includeKnowledgeBase,
      }),
    [includeKnowledgeBase, localExcludedSourceIds, mode, sources, workspace],
  );
  const hasExcludedSources = useMemo(
    () => excludedSourceIds.some((id) => selectableSourceIds.has(id)),
    [excludedSourceIds, selectableSourceIds],
  );

  const handleToggleKnowledgeBase = useCallback(
    () => applyKnowledgeBaseToggle(mode, workspace, includeKnowledgeBase, updatePreference),
    [includeKnowledgeBase, mode, updatePreference, workspace],
  );

  const handleToggleSourceSelection = useCallback(
    (sourceId: string) =>
      applySourceSelectionToggle({
        mode,
        workspace,
        sources,
        localExcludedSourceIds,
        sourceId,
        includeKnowledgeBase,
        setLocalExcludedSourceIds,
        updatePreference,
      }),
    [includeKnowledgeBase, localExcludedSourceIds, mode, sources, updatePreference, workspace],
  );

  const handleSetSectionSourcesSelected = useCallback(
    (sourceType: KnowledgeSource["sourceType"], selected: boolean) =>
      applySectionSourcesToggle({
        mode,
        workspace,
        sources,
        localExcludedSourceIds,
        sourceType,
        selected,
        includeKnowledgeBase,
        setLocalExcludedSourceIds,
        updatePreference,
      }),
    [includeKnowledgeBase, localExcludedSourceIds, mode, sources, updatePreference, workspace],
  );

  const handleSetAllSourcesSelected = useCallback(
    (selected: boolean) =>
      applyAllSourcesToggle({
        mode,
        workspace,
        sources,
        selected,
        includeKnowledgeBase,
        setLocalExcludedSourceIds,
        updatePreference,
      }),
    [includeKnowledgeBase, mode, sources, updatePreference, workspace],
  );

  return {
    completedDocumentIds,
    failedDocuments,
    knowledgeBaseDocumentIds,
    knowledgeBaseCount: knowledgeBaseDocumentIds.size,
    selectedSourceIds,
    hasExcludedSources,
    handleToggleKnowledgeBase,
    handleToggleSourceSelection,
    handleSetSectionSourcesSelected,
    handleSetAllSourcesSelected,
  };
}

function useChatQuestionRunner(params: {
  mode: ChatLayoutMode;
  workspace: WorkspaceContextValue;
  includeKnowledgeBase: boolean;
  focusedDocument: { id: string } | null;
  knowledgeBaseDocumentIds: Set<string>;
  hasExcludedSources: boolean;
  selectedSourceIds: string[];
  mountedRef: React.MutableRefObject<boolean>;
  messagesRef: React.MutableRefObject<ChatMessageType[]>;
  isTemporaryChatRef: React.MutableRefObject<boolean>;
  isLoadingSessionRef: React.MutableRefObject<boolean>;
  isLoadingRef: React.MutableRefObject<boolean>;
  conversationRunRef: React.MutableRefObject<number>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  activeJobIdRef: React.MutableRefObject<string | null>;
  activeSmootherRef: React.MutableRefObject<TextStreamSmoother | null>;
  activeSessionIdRef: React.MutableRefObject<string | null>;
  loadedSessionRef: React.MutableRefObject<string | null>;
  queuedMessagesRef: React.MutableRefObject<QueuedChatMessage[]>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  setIsLoading: (loading: boolean) => void;
  setQueuedMessages: (messages: QueuedChatMessage[]) => void;
  setActiveSessionId: (id: string | null) => void;
  setRecentSessionRows: React.Dispatch<React.SetStateAction<ChatSessionSummary[]>>;
  refreshRecentChats: () => Promise<void>;
  pinToBottomForNewTurn: () => void;
}) {
  const {
    mode,
    workspace,
    includeKnowledgeBase,
    focusedDocument,
    knowledgeBaseDocumentIds,
    hasExcludedSources,
    selectedSourceIds,
    mountedRef,
    messagesRef,
    isTemporaryChatRef,
    isLoadingSessionRef,
    isLoadingRef,
    conversationRunRef,
    abortControllerRef,
    activeJobIdRef,
    activeSmootherRef,
    activeSessionIdRef,
    loadedSessionRef,
    queuedMessagesRef,
    setMessages,
    setIsLoading,
    setQueuedMessages,
    setActiveSessionId,
    setRecentSessionRows,
    refreshRecentChats,
    pinToBottomForNewTurn,
  } = params;

  const runQuestion = useCallback(
    async (
      question: string,
      selectedSuggestion?: AutocompleteSuggestion,
      runScope = conversationRunRef.current,
      historyOverride?: ChatMessageType[],
      scopedDocumentIds?: string[],
    ) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || isLoadingSessionRef.current) return;

      const isTemporaryRun = mode !== "demo" && isTemporaryChatRef.current;
      const priorMessages = historyOverride ?? messagesRef.current;
      const conversationHistory = isTemporaryRun ? toConversationHistory(priorMessages) : undefined;
      const { userMessage, assistantId, assistantPlaceholder } = createTurnPlaceholderMessages(trimmedQuestion);

      pinToBottomForNewTurn();
      setMessages((current) => [...current, userMessage, assistantPlaceholder]);
      setIsLoading(true);
      isLoadingRef.current = true;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const turnState: TurnRuntimeState = {
        expectedSessionId: isTemporaryRun ? null : activeSessionIdRef.current,
        drainPromise: null,
        doneResponse: null,
      };

      const isRunAttached = () =>
        mountedRef.current &&
        conversationRunRef.current === runScope &&
        (isTemporaryRun ? isTemporaryChatRef.current : activeSessionIdRef.current === turnState.expectedSessionId);

      const smoother = createTurnSmoother(assistantId, isRunAttached, turnState, setMessages);
      activeSmootherRef.current = smoother;

      const handleAbort = () => {
        smoother.stop();
      };
      abortController.signal.addEventListener("abort", handleAbort, { once: true });

      const requestOptions = buildStreamRequestOptions({
        retrievalHint: resolveRetrievalHint(selectedSuggestion, scopedDocumentIds, focusedDocument),
        isTemporaryRun,
        conversationHistory,
        expectedSessionId: turnState.expectedSessionId,
        includeKnowledgeBase: resolveTurnIncludeKnowledgeBase(
          includeKnowledgeBase,
          scopedDocumentIds,
          knowledgeBaseDocumentIds,
        ),
        scopedDocumentIds,
        hasExcludedSources,
        selectedSourceIds,
        signal: abortController.signal,
      });

      const streamHandlers = createTurnStreamHandlers({
        mode,
        assistantId,
        isTemporaryRun,
        isRunAttached,
        turnState,
        smoother,
        activeJobIdRef,
        activeSessionIdRef,
        loadedSessionRef,
        workspace,
        setActiveSessionId,
        setMessages,
        setRecentSessionRows,
        refreshRecentChats,
      });

      try {
        await executeStreamTurn({
          mode,
          trimmedQuestion,
          streamHandlers,
          requestOptions,
          abortSignal: abortController.signal,
          smoother,
          turnState,
          isRunAttached,
          assistantId,
          setMessages,
        });
      } finally {
        finalizeQuestionTurn({
          abortSignal: abortController.signal,
          handleAbort,
          smoother,
          abortController,
          activeSmootherRef,
          abortControllerRef,
          activeJobIdRef,
          conversationRunRef,
          runScope,
          setIsLoading,
          isLoadingRef,
          queuedMessagesRef,
          setQueuedMessages,
          priorMessages,
          userMessage,
          assistantPlaceholder,
          doneResponse: turnState.doneResponse,
          onDispatchNext: runQuestion,
        });
      }
    },
    [
      abortControllerRef,
      activeJobIdRef,
      activeSessionIdRef,
      activeSmootherRef,
      conversationRunRef,
      focusedDocument,
      hasExcludedSources,
      includeKnowledgeBase,
      isLoadingRef,
      isLoadingSessionRef,
      isTemporaryChatRef,
      knowledgeBaseDocumentIds,
      loadedSessionRef,
      messagesRef,
      mode,
      mountedRef,
      pinToBottomForNewTurn,
      queuedMessagesRef,
      refreshRecentChats,
      selectedSourceIds,
      setActiveSessionId,
      setIsLoading,
      setMessages,
      setQueuedMessages,
      setRecentSessionRows,
      workspace,
    ],
  );

  return { runQuestion };
}

function abortActiveChatTurn(params: {
  isDemoMode: boolean;
  abortActive: boolean;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  activeJobIdRef: React.MutableRefObject<string | null>;
}) {
  const jobId = params.activeJobIdRef.current;
  params.activeJobIdRef.current = null;
  if (params.abortActive) {
    params.abortControllerRef.current?.abort();
    if (!params.isDemoMode) {
      cancelServerChatJob(jobId);
    }
  }
  params.abortControllerRef.current = null;
}

function useChatConversationReset(params: {
  isDemoMode: boolean;
  workspace: WorkspaceContextValue;
  conversationRunRef: React.MutableRefObject<number>;
  activeSmootherRef: React.MutableRefObject<TextStreamSmoother | null>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  activeJobIdRef: React.MutableRefObject<string | null>;
  isLoadingRef: React.MutableRefObject<boolean>;
  isLoadingSessionRef: React.MutableRefObject<boolean>;
  isTemporaryChatRef: React.MutableRefObject<boolean>;
  activeSessionIdRef: React.MutableRefObject<string | null>;
  messagesRef: React.MutableRefObject<ChatMessageType[]>;
  queuedMessagesRef: React.MutableRefObject<QueuedChatMessage[]>;
  loadedSessionRef: React.MutableRefObject<string | null>;
  setLocalTemporaryChat: (next: boolean) => void;
  setIsLoadingSession: (loading: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setActiveSessionId: (id: string | null) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  setQueuedMessages: (messages: QueuedChatMessage[]) => void;
}) {
  const {
    isDemoMode,
    workspace,
    conversationRunRef,
    activeSmootherRef,
    abortControllerRef,
    activeJobIdRef,
    isLoadingRef,
    isLoadingSessionRef,
    isTemporaryChatRef,
    activeSessionIdRef,
    messagesRef,
    queuedMessagesRef,
    loadedSessionRef,
    setLocalTemporaryChat,
    setIsLoadingSession,
    setIsLoading,
    setActiveSessionId,
    setMessages,
    setQueuedMessages,
  } = params;

  const setTemporaryChat = useCallback(
    (next: boolean) => {
      if (isDemoMode) return;
      isTemporaryChatRef.current = next;
      if (workspace) {
        workspace.setIsTemporaryChat(next);
      } else {
        setLocalTemporaryChat(next);
      }
    },
    [isDemoMode, isTemporaryChatRef, setLocalTemporaryChat, workspace],
  );

  const resetConversationState = useCallback(
    (options: { temporary: boolean; abortActive: boolean }) => {
      conversationRunRef.current += 1;
      activeSmootherRef.current?.stop();
      activeSmootherRef.current = null;
      abortActiveChatTurn({
        isDemoMode,
        abortActive: options.abortActive,
        abortControllerRef,
        activeJobIdRef,
      });
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
      if (!isDemoMode) window.history.pushState(null, "", "/chat");
    },
    [
      abortControllerRef,
      activeJobIdRef,
      activeSessionIdRef,
      activeSmootherRef,
      conversationRunRef,
      isDemoMode,
      isLoadingRef,
      isLoadingSessionRef,
      loadedSessionRef,
      messagesRef,
      queuedMessagesRef,
      setActiveSessionId,
      setIsLoading,
      setIsLoadingSession,
      setMessages,
      setQueuedMessages,
      setTemporaryChat,
      workspace,
    ],
  );

  const handleNewChat = useCallback(() => {
    resetConversationState({
      temporary: false,
      abortActive: isDemoMode || isTemporaryChatRef.current,
    });
  }, [isDemoMode, isTemporaryChatRef, resetConversationState]);

  const handleToggleTemporaryChat = useCallback(() => {
    if (isDemoMode) return;
    resetConversationState({
      temporary: !isTemporaryChatRef.current,
      abortActive: isTemporaryChatRef.current,
    });
  }, [isDemoMode, isTemporaryChatRef, resetConversationState]);

  return {
    setTemporaryChat,
    handleNewChat,
    handleToggleTemporaryChat,
  };
}

function useChatUploadActions(params: {
  isDemoMode: boolean;
  workspace: WorkspaceContextValue;
  userId?: string;
  isLoaded: boolean;
  isSignedIn: boolean;
  completedDocumentIds: Set<string>;
  failedDocuments: Map<string, string>;
  setPollDocuments: (poll: boolean) => void;
  setShowSignupModal: (open: boolean) => void;
}) {
  const {
    isDemoMode,
    workspace,
    userId,
    isLoaded,
    isSignedIn,
    completedDocumentIds,
    failedDocuments,
    setPollDocuments,
    setShowSignupModal,
  } = params;
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const onNewIndexingDocument = useCallback(() => {
    setPollDocuments(true);
    workspace?.refreshSources({ force: true }).catch(noop);
  }, [setPollDocuments, workspace]);

  const { uploadToasts, dismissToast, handleUploadToast: localHandleUploadToast } = useDocumentUploadToasts({
    completedDocumentIds,
    failedDocuments,
    onNewIndexingDocument,
  });

  const handleUploadToast = useCallback(
    (payload: UploadToastPayload) => {
      if (workspace && !isDemoMode) {
        workspace.handleUploadToast(payload);
        if (payload.documentId) setPollDocuments(true);
      } else {
        localHandleUploadToast(payload);
      }
    },
    [isDemoMode, localHandleUploadToast, setPollDocuments, workspace],
  );

  const uploadDroppedFiles = useCallback(
    (files: File[]) => {
      if (!files.length || isDemoMode) return;

      files.forEach((file) => {
        uploadDocumentFile({
          file,
          userId,
          isAuthLoaded: isLoaded,
          isSignedIn,
          toastValidationFailures: true,
          onToast: handleUploadToast,
        }).catch(noop);
      });
    },
    [handleUploadToast, isDemoMode, isLoaded, isSignedIn, userId],
  );

  const triggerOpenUpload = useCallback(() => {
    if (isDemoMode) {
      setShowSignupModal(true);
      return;
    }
    if (workspace) {
      workspace.openUploadModal("personal");
      return;
    }
    setIsUploadOpen(true);
  }, [isDemoMode, setShowSignupModal, workspace]);

  return {
    isUploadOpen,
    setIsUploadOpen,
    uploadToasts,
    dismissToast,
    handleUploadToast,
    uploadDroppedFiles,
    triggerOpenUpload,
  };
}

function executeSubmittedQuestion(params: {
  question: string;
  selectedSuggestion?: AutocompleteSuggestion;
  scopedDocumentIds?: string[];
  isDemoMode: boolean;
  hasReachedLimit: boolean;
  decrementQuestion: () => boolean;
  setShowSignupModal: (open: boolean) => void;
  isLoadingRef: React.MutableRefObject<boolean>;
  isLoadingSessionRef: React.MutableRefObject<boolean>;
  queuedMessagesRef: React.MutableRefObject<QueuedChatMessage[]>;
  conversationRunRef: React.MutableRefObject<number>;
  setQueuedMessages: React.Dispatch<React.SetStateAction<QueuedChatMessage[]>>;
  runQuestion: (
    question: string,
    selectedSuggestion?: AutocompleteSuggestion,
    runScope?: number,
    historyOverride?: ChatMessageType[],
    scopedDocumentIds?: string[],
  ) => Promise<void>;
}): boolean {
  const trimmedQuestion = params.question.trim();
  if (!trimmedQuestion || params.isLoadingSessionRef.current) return false;

  if (params.isDemoMode && (params.hasReachedLimit || !params.decrementQuestion())) {
    params.setShowSignupModal(true);
    return false;
  }

  if (!params.isLoadingRef.current) {
    params
      .runQuestion(
        trimmedQuestion,
        params.selectedSuggestion,
        params.conversationRunRef.current,
        undefined,
        params.scopedDocumentIds,
      )
      .catch(noop);
    return true;
  }

  return tryEnqueueSubmittedQuestion({
    question: trimmedQuestion,
    selectedSuggestion: params.selectedSuggestion,
    scopedDocumentIds: params.scopedDocumentIds,
    queuedMessagesRef: params.queuedMessagesRef,
    setQueuedMessages: params.setQueuedMessages,
  });
}

function redirectSignedOutWorkspaceUser(params: {
  mode: ChatLayoutMode;
  isLoaded: boolean;
  isSignedIn: boolean;
  hasUser: boolean;
  conversationRunRef: React.MutableRefObject<number>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  activeJobIdRef: React.MutableRefObject<string | null>;
  queuedMessagesRef: React.MutableRefObject<QueuedChatMessage[]>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  setQueuedMessages: (messages: QueuedChatMessage[]) => void;
  router: ReturnType<typeof useRouter>;
}) {
  if (params.mode === "demo" || !params.isLoaded) return;
  if (params.isSignedIn && params.hasUser) return;
  params.conversationRunRef.current += 1;
  params.abortControllerRef.current?.abort();
  params.abortControllerRef.current = null;
  params.activeJobIdRef.current = null;
  params.setMessages([]);
  params.setQueuedMessages([]);
  params.queuedMessagesRef.current = [];
  params.router.replace("/sign-in?next=/chat");
}

function syncTemporaryStateOnSessionParamChange(
  mode: ChatLayoutMode,
  sessionParam: string | null,
  prevSessionParamRef: React.MutableRefObject<string | null>,
  setTemporaryChat: (next: boolean) => void,
) {
  if (mode !== "demo" && sessionParam && sessionParam !== prevSessionParamRef.current) {
    setTemporaryChat(false);
  }
  prevSessionParamRef.current = sessionParam;
}

function syncWorkspaceActiveSession(
  workspace: WorkspaceContextValue,
  mode: ChatLayoutMode,
  activeSessionId: string | null,
) {
  if (!workspace || mode === "demo") return;
  workspace.setActiveSessionId(activeSessionId);
}

function registerWorkspaceSessionListeners(params: {
  workspace: WorkspaceContextValue;
  mode: ChatLayoutMode;
  activeSessionIdRef: React.MutableRefObject<string | null>;
  sessionParam: string | null;
  setRecentSessionRows: React.Dispatch<React.SetStateAction<ChatSessionSummary[]>>;
  handleNewChat: () => void;
  handleToggleTemporaryChat: () => void;
}) {
  if (!params.workspace || params.mode === "demo") return;
  const handleDeletedSession = (deletedSessionId: string) => {
    params.setRecentSessionRows(removeSessionById(deletedSessionId));
    if (deletedSessionId === params.activeSessionIdRef.current || deletedSessionId === params.sessionParam) {
      params.handleNewChat();
    }
  };
  return params.workspace.registerSessionLifecycle({
    onSessionDeleted: handleDeletedSession,
    onNewChat: params.handleNewChat,
    onToggleTemporaryChat: params.handleToggleTemporaryChat,
  });
}

function useChatSubmissionActions(params: {
  isDemoMode: boolean;
  hasReachedLimit: boolean;
  decrementQuestion: () => boolean;
  setShowSignupModal: (open: boolean) => void;
  messages: ChatMessageType[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  setQueuedMessages: React.Dispatch<React.SetStateAction<QueuedChatMessage[]>>;
  isLoadingRef: React.MutableRefObject<boolean>;
  isLoadingSessionRef: React.MutableRefObject<boolean>;
  queuedMessagesRef: React.MutableRefObject<QueuedChatMessage[]>;
  conversationRunRef: React.MutableRefObject<number>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  activeJobIdRef: React.MutableRefObject<string | null>;
  runQuestion: (
    question: string,
    selectedSuggestion?: AutocompleteSuggestion,
    runScope?: number,
    historyOverride?: ChatMessageType[],
    scopedDocumentIds?: string[],
  ) => Promise<void>;
}) {
  const {
    isDemoMode,
    hasReachedLimit,
    decrementQuestion,
    setShowSignupModal,
    messages,
    setMessages,
    setQueuedMessages,
    isLoadingRef,
    isLoadingSessionRef,
    queuedMessagesRef,
    conversationRunRef,
    abortControllerRef,
    activeJobIdRef,
    runQuestion,
  } = params;

  const handleSubmit = useCallback(
    (
      question: string,
      selectedSuggestion?: AutocompleteSuggestion,
      scopedDocumentIds?: string[],
    ) =>
      executeSubmittedQuestion({
        question,
        selectedSuggestion,
        scopedDocumentIds,
        isDemoMode,
        hasReachedLimit,
        decrementQuestion,
        setShowSignupModal,
        isLoadingRef,
        isLoadingSessionRef,
        queuedMessagesRef,
        conversationRunRef,
        setQueuedMessages,
        runQuestion,
      }),
    [
      conversationRunRef,
      decrementQuestion,
      hasReachedLimit,
      isDemoMode,
      isLoadingRef,
      isLoadingSessionRef,
      queuedMessagesRef,
      runQuestion,
      setQueuedMessages,
      setShowSignupModal,
    ],
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
    [conversationRunRef, isLoadingRef, isLoadingSessionRef, messages, runQuestion, setMessages],
  );

  const handleRemoveQueuedMessage = useCallback(
    (queuedMessageId: string) => {
      setQueuedMessages((current) => {
        const next = current.filter((message) => message.id !== queuedMessageId);
        queuedMessagesRef.current = next;
        return next;
      });
    },
    [queuedMessagesRef, setQueuedMessages],
  );

  const handleStopResponse = useCallback(() => {
    abortControllerRef.current?.abort();
    const jobId = activeJobIdRef.current;
    activeJobIdRef.current = null;
    cancelServerChatJob(jobId);
  }, [abortControllerRef, activeJobIdRef]);

  return {
    handleSubmit,
    handleRetryMessage,
    handleRemoveQueuedMessage,
    handleStopResponse,
  };
}

function useWorkspaceSessionLifecycle(params: {
  mode: ChatLayoutMode;
  workspace: WorkspaceContextValue;
  isLoaded: boolean;
  isSignedIn: boolean;
  hasUser: boolean;
  sessionParam: string | null;
  activeSessionId: string | null;
  activeSessionIdRef: React.MutableRefObject<string | null>;
  prevSessionParamRef: React.MutableRefObject<string | null>;
  conversationRunRef: React.MutableRefObject<number>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
  activeJobIdRef: React.MutableRefObject<string | null>;
  queuedMessagesRef: React.MutableRefObject<QueuedChatMessage[]>;
  setTemporaryChat: (next: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessageType[]>>;
  setQueuedMessages: (messages: QueuedChatMessage[]) => void;
  setRecentSessionRows: React.Dispatch<React.SetStateAction<ChatSessionSummary[]>>;
  handleNewChat: () => void;
  handleToggleTemporaryChat: () => void;
  router: ReturnType<typeof useRouter>;
}) {
  const {
    mode,
    workspace,
    isLoaded,
    isSignedIn,
    hasUser,
    sessionParam,
    activeSessionId,
    activeSessionIdRef,
    prevSessionParamRef,
    conversationRunRef,
    abortControllerRef,
    activeJobIdRef,
    queuedMessagesRef,
    setTemporaryChat,
    setMessages,
    setQueuedMessages,
    setRecentSessionRows,
    handleNewChat,
    handleToggleTemporaryChat,
    router,
  } = params;

  useEffect(() => {
    redirectSignedOutWorkspaceUser({
      mode,
      isLoaded,
      isSignedIn,
      hasUser,
      conversationRunRef,
      abortControllerRef,
      activeJobIdRef,
      queuedMessagesRef,
      setMessages,
      setQueuedMessages,
      router,
    });
  }, [
    abortControllerRef,
    activeJobIdRef,
    conversationRunRef,
    hasUser,
    isLoaded,
    isSignedIn,
    mode,
    queuedMessagesRef,
    router,
    setMessages,
    setQueuedMessages,
  ]);

  useEffect(() => {
    syncTemporaryStateOnSessionParamChange(mode, sessionParam, prevSessionParamRef, setTemporaryChat);
  }, [mode, prevSessionParamRef, sessionParam, setTemporaryChat]);

  useEffect(() => {
    syncWorkspaceActiveSession(workspace, mode, activeSessionId);
  }, [activeSessionId, mode, workspace]);

  // Listen to sidebar session deletion & New Chat / Temporary Chat events from WorkspaceShell
  useEffect(
    () =>
      registerWorkspaceSessionListeners({
        workspace,
        mode,
        activeSessionIdRef,
        sessionParam,
        setRecentSessionRows,
        handleNewChat,
        handleToggleTemporaryChat,
      }),
    [
      activeSessionIdRef,
      handleNewChat,
      handleToggleTemporaryChat,
      mode,
      sessionParam,
      setRecentSessionRows,
      workspace,
    ],
  );
}

type ChatConversationViewProps = {
  isLoadingSession: boolean;
  messages: ChatMessageType[];
  isLoading: boolean;
  hasPersonalSources: boolean;
  sourceStatus: SourceStatus;
  includeKnowledgeBase: boolean;
  isDemo: boolean;
  isTemporaryChat: boolean;
  onRetryMessage?: (assistantMessageIndex: number) => void;
  onSendFollowUp?: (prompt: string) => void;
  onOpenUpload?: () => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
};

function ChatConversationView({
  isLoadingSession,
  messages,
  isLoading,
  hasPersonalSources,
  sourceStatus,
  includeKnowledgeBase,
  isDemo,
  isTemporaryChat,
  onRetryMessage,
  onSendFollowUp,
  onOpenUpload,
  bottomRef,
}: Readonly<ChatConversationViewProps>) {
  if (isLoadingSession) {
    return (
      <div className="chat-fade-in mx-auto max-w-5xl space-y-4 py-10">
        <div className="h-12 w-2/3 max-w-md animate-pulse rounded-3xl bg-white/5" />
        <div className="h-24 w-full max-w-3xl animate-pulse rounded-3xl bg-white/5" />
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <ChatWelcome
        hasPersonalSources={hasPersonalSources}
        sourceStatus={sourceStatus}
        includeKnowledgeBase={includeKnowledgeBase}
        isDemo={isDemo}
        isTemporaryChat={isTemporaryChat}
        onOpenUpload={onOpenUpload}
      />
    );
  }
  return (
    <div className="chat-enter mx-auto max-w-5xl space-y-5">
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
            onSendFollowUp={message.role === "assistant" ? onSendFollowUp : undefined}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

function ChatDragOverlay() {
  return (
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
  );
}

function DemoLimitBanner({ onOpenSignup }: Readonly<{ onOpenSignup: () => void }>) {
  return (
    <div className="pointer-events-auto relative z-20 mx-auto mb-3 flex w-full max-w-4xl items-center gap-2 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-2.5 text-sm text-red-100 shadow-lg">
      <span className="font-semibold">Demo limit reached.</span>
      <span>Sign up for free to continue chatting and unlock uploads.</span>
      <button
        type="button"
        onClick={onOpenSignup}
        className="ml-auto shrink-0 rounded-xl bg-red-300 px-3 py-1.5 text-xs font-semibold text-red-950 transition hover:bg-red-200"
      >
        Sign up
      </button>
    </div>
  );
}

function DemoRemainingFooter({
  remaining,
  onOpenSignup,
}: Readonly<{ remaining: number; onOpenSignup: () => void }>) {
  return (
    <div className="pointer-events-auto relative z-20 mx-auto mt-2 flex w-full max-w-4xl items-center justify-between text-xs text-slate-500">
      <span>
        Demo mode — {remaining} question{remaining === 1 ? "" : "s"} remaining
      </span>
      <button
        type="button"
        onClick={onOpenSignup}
        className="text-cyan-200 underline transition hover:text-cyan-100"
      >
        Sign up for full access
      </button>
    </div>
  );
}

function ScrollToBottomControl({
  isVisible,
  onScroll,
  onInteractionStart,
  onInteractionEnd,
}: Readonly<{
  isVisible: boolean;
  onScroll: () => void;
  onInteractionStart: () => void;
  onInteractionEnd: () => void;
}>) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full z-10 mb-3 flex justify-center">
      <button
        type="button"
        data-visible={isVisible ? "true" : "false"}
        aria-hidden={!isVisible}
        tabIndex={isVisible ? 0 : -1}
        onClick={onScroll}
        onMouseEnter={onInteractionStart}
        onMouseLeave={onInteractionEnd}
        onFocus={onInteractionStart}
        onBlur={onInteractionEnd}
        className="chat-scroll-btn flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/30 bg-slate-950/90 text-cyan-300 shadow-lg shadow-cyan-950/30 backdrop-blur-xl hover:border-cyan-300/60 hover:bg-slate-900 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        aria-label="Scroll to latest message"
        title="Scroll to latest message"
      >
        <ArrowDown className="h-4 w-4" />
      </button>
    </div>
  );
}

function buildComposerSourceProps(params: {
  isDemoMode: boolean;
  sources: KnowledgeSource[];
  selectedSourceIds: string[];
  onToggleKnowledgeBase: () => void;
  onToggleSourceSelection: (sourceId: string) => void;
  onSetSectionSourcesSelected: (sourceType: KnowledgeSource["sourceType"], selected: boolean) => void;
  onSetAllSourcesSelected: (selected: boolean) => void;
  triggerOpenUpload: () => void;
  uploadDroppedFiles: (files: File[]) => void;
}) {
  if (params.isDemoMode) return {};
  return {
    sources: params.sources,
    selectedSourceIds: params.selectedSourceIds,
    onToggleKnowledgeBase: params.onToggleKnowledgeBase,
    onToggleSourceSelection: params.onToggleSourceSelection,
    onSetSectionSourcesSelected: params.onSetSectionSourcesSelected,
    onSetAllSourcesSelected: params.onSetAllSourcesSelected,
    onOpenUpload: params.triggerOpenUpload,
    onUploadFiles: params.uploadDroppedFiles,
  };
}

type ChatComposerSectionProps = {
  isDemoMode: boolean;
  isNewChatEmpty: boolean;
  isLoadingSession: boolean;
  isLoading: boolean;
  isTemporaryChat: boolean;
  hasMessages: boolean;
  showScrollToBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  onScrollButtonInteractionStart: () => void;
  onScrollButtonInteractionEnd: () => void;
  hasReachedLimit: boolean;
  remaining: number;
  autocompleteSuggestions: AutocompleteSuggestion[];
  queuedMessages: QueuedChatMessage[];
  focusedDocument: Parameters<typeof ChatComposer>[0]["focusedDocument"];
  includeKnowledgeBase: boolean;
  knowledgeBaseCount: number;
  sources: KnowledgeSource[];
  selectedSourceIds: string[];
  hasWorkspace: boolean;
  onClearFocusedDocument?: () => void;
  onToggleKnowledgeBase: () => void;
  onToggleSourceSelection: (sourceId: string) => void;
  onSetSectionSourcesSelected: (sourceType: KnowledgeSource["sourceType"], selected: boolean) => void;
  onSetAllSourcesSelected: (selected: boolean) => void;
  triggerOpenUpload: () => void;
  uploadDroppedFiles: (files: File[]) => void;
  onSubmit: (
    question: string,
    selectedSuggestion?: AutocompleteSuggestion,
    scopedDocumentIds?: string[],
  ) => boolean;
  onRemoveQueuedMessage: (queuedMessageId: string) => void;
  onStopResponse: () => void;
  onOpenSignupModal: () => void;
};

function ChatComposerSection({
  isDemoMode,
  isNewChatEmpty,
  isLoadingSession,
  isLoading,
  isTemporaryChat,
  hasMessages,
  showScrollToBottom,
  scrollToBottom,
  onScrollButtonInteractionStart,
  onScrollButtonInteractionEnd,
  hasReachedLimit,
  remaining,
  autocompleteSuggestions,
  queuedMessages,
  focusedDocument,
  includeKnowledgeBase,
  knowledgeBaseCount,
  sources,
  selectedSourceIds,
  hasWorkspace,
  onClearFocusedDocument,
  onToggleKnowledgeBase,
  onToggleSourceSelection,
  onSetSectionSourcesSelected,
  onSetAllSourcesSelected,
  triggerOpenUpload,
  uploadDroppedFiles,
  onSubmit,
  onRemoveQueuedMessage,
  onStopResponse,
  onOpenSignupModal,
}: Readonly<ChatComposerSectionProps>) {
  const composerSourceProps = buildComposerSourceProps({
    isDemoMode,
    sources,
    selectedSourceIds,
    onToggleKnowledgeBase,
    onToggleSourceSelection,
    onSetSectionSourcesSelected,
    onSetAllSourcesSelected,
    triggerOpenUpload,
    uploadDroppedFiles,
  });

  return (
    <div className={isNewChatEmpty ? "z-20 pb-2 pt-1" : "pointer-events-none sticky bottom-0 z-20 pt-2"}>
      <div className={isNewChatEmpty ? "" : "relative -mx-4 px-4 pb-4 sm:-mx-6 sm:px-6 sm:pb-5"}>
        {!isNewChatEmpty && <div aria-hidden="true" className="chat-bottom-scrim" />}
        {!isNewChatEmpty && hasMessages && (
          <ScrollToBottomControl
            isVisible={showScrollToBottom}
            onScroll={() => scrollToBottom("smooth")}
            onInteractionStart={onScrollButtonInteractionStart}
            onInteractionEnd={onScrollButtonInteractionEnd}
          />
        )}
        {isDemoMode && hasReachedLimit && <DemoLimitBanner onOpenSignup={onOpenSignupModal} />}
        <ChatComposer
          autocompleteSuggestions={autocompleteSuggestions}
          disabled={isLoadingSession || (isDemoMode && hasReachedLimit)}
          isResponding={isLoading}
          queuedMessages={queuedMessages}
          queueLimit={QUEUE_LIMIT}
          focusedDocument={focusedDocument}
          includeKnowledgeBase={includeKnowledgeBase}
          isTemporaryChat={isTemporaryChat}
          hasPriorMessages={hasMessages}
          knowledgeBaseCount={knowledgeBaseCount}
          {...composerSourceProps}
          onClearFocusedDocument={hasWorkspace ? onClearFocusedDocument : undefined}
          onSubmit={onSubmit}
          onRemoveQueuedMessage={onRemoveQueuedMessage}
          onStopResponse={onStopResponse}
        />
        {isDemoMode && !hasReachedLimit && (
          <DemoRemainingFooter remaining={remaining} onOpenSignup={onOpenSignupModal} />
        )}
      </div>
    </div>
  );
}

type ChatSurfaceModalsProps = {
  hasWorkspace: boolean;
  isUploadOpen: boolean;
  setIsUploadOpen: (open: boolean) => void;
  handleUploadToast: (payload: UploadToastPayload) => void;
  completedDocumentIds: Set<string>;
  failedDocuments: Map<string, string>;
  uploadToasts: ReturnType<typeof useDocumentUploadToasts>["uploadToasts"];
  dismissToast: (id: string) => void;
  isLoading: boolean;
  retrievalMessage: string;
  showSignupModal: boolean;
  setShowSignupModal: (open: boolean) => void;
};

function ChatSurfaceModals({
  hasWorkspace,
  isUploadOpen,
  setIsUploadOpen,
  handleUploadToast,
  completedDocumentIds,
  failedDocuments,
  uploadToasts,
  dismissToast,
  isLoading,
  retrievalMessage,
  showSignupModal,
  setShowSignupModal,
}: Readonly<ChatSurfaceModalsProps>) {
  return (
    <>
      {!hasWorkspace && (
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
}

type ChatSurfaceViewProps = {
  isDemoMode: boolean;
  isNewChatEmpty: boolean;
  isTemporaryChat: boolean;
  isChatFileDragging: boolean;
  dragProps: ReturnType<typeof useChatDragAndDrop>["dragProps"];
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  handleWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
  handleTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  handleTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
  isLoadingSession: boolean;
  messages: ChatMessageType[];
  isLoading: boolean;
  hasPersonalSources: boolean;
  sourceStatus: SourceStatus;
  includeKnowledgeBase: boolean;
  showScrollToBottom: boolean;
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  onScrollButtonInteractionStart: () => void;
  onScrollButtonInteractionEnd: () => void;
  hasReachedLimit: boolean;
  remaining: number;
  autocompleteSuggestions: AutocompleteSuggestion[];
  queuedMessages: QueuedChatMessage[];
  focusedDocument: Parameters<typeof ChatComposer>[0]["focusedDocument"];
  knowledgeBaseCount: number;
  sources: KnowledgeSource[];
  selectedSourceIds: string[];
  workspace: WorkspaceContextValue;
  onToggleKnowledgeBase: () => void;
  onToggleSourceSelection: (sourceId: string) => void;
  onSetSectionSourcesSelected: (sourceType: KnowledgeSource["sourceType"], selected: boolean) => void;
  onSetAllSourcesSelected: (selected: boolean) => void;
  onSubmit: (
    question: string,
    selectedSuggestion?: AutocompleteSuggestion,
    scopedDocumentIds?: string[],
  ) => boolean;
  onRetryMessage: (assistantIndex: number) => void;
  onRemoveQueuedMessage: (queuedMessageId: string) => void;
  onStopResponse: () => void;
  onToggleTemporaryChat: () => void;
  triggerOpenUpload: () => void;
  uploadDroppedFiles: (files: File[]) => void;
  isUploadOpen: boolean;
  setIsUploadOpen: (open: boolean) => void;
  handleUploadToast: (payload: UploadToastPayload) => void;
  completedDocumentIds: Set<string>;
  failedDocuments: Map<string, string>;
  uploadToasts: ReturnType<typeof useDocumentUploadToasts>["uploadToasts"];
  dismissToast: (id: string) => void;
  retrievalMessage: string;
  showSignupModal: boolean;
  setShowSignupModal: (open: boolean) => void;
};

function ChatSurfaceView({
  isDemoMode,
  isNewChatEmpty,
  isTemporaryChat,
  isChatFileDragging,
  dragProps,
  scrollContainerRef,
  bottomRef,
  handleScroll,
  handleWheel,
  handleTouchStart,
  handleTouchMove,
  isLoadingSession,
  messages,
  isLoading,
  hasPersonalSources,
  sourceStatus,
  includeKnowledgeBase,
  showScrollToBottom,
  scrollToBottom,
  onScrollButtonInteractionStart,
  onScrollButtonInteractionEnd,
  hasReachedLimit,
  remaining,
  autocompleteSuggestions,
  queuedMessages,
  focusedDocument,
  knowledgeBaseCount,
  sources,
  selectedSourceIds,
  workspace,
  onToggleKnowledgeBase,
  onToggleSourceSelection,
  onSetSectionSourcesSelected,
  onSetAllSourcesSelected,
  onSubmit,
  onRetryMessage,
  onRemoveQueuedMessage,
  onStopResponse,
  onToggleTemporaryChat,
  triggerOpenUpload,
  uploadDroppedFiles,
  isUploadOpen,
  setIsUploadOpen,
  handleUploadToast,
  completedDocumentIds,
  failedDocuments,
  uploadToasts,
  dismissToast,
  retrievalMessage,
  showSignupModal,
  setShowSignupModal,
}: Readonly<ChatSurfaceViewProps>) {
  const openSignupModal = () => setShowSignupModal(true);
  const clearFocusedDocument = () => workspace?.setFocusedDocument(null);

  return (
    <div className={`chat-fade-in relative flex min-h-0 flex-1 flex-col ${isNewChatEmpty ? "chat-new-gradient" : ""}`}>
      <ChatHeader
        onOpenUpload={triggerOpenUpload}
        isTemporaryChat={isTemporaryChat}
        onToggleTemporaryChat={isDemoMode ? undefined : onToggleTemporaryChat}
      />
      <div className="relative flex min-h-0 flex-1" {...dragProps}>
        {isChatFileDragging && <ChatDragOverlay />}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            className={`scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-6 ${isNewChatEmpty ? "pb-2" : "pb-0"}`}
          >
            <div className={`flex min-h-full flex-col ${isNewChatEmpty ? "justify-center py-6" : ""}`}>
              <div className={isNewChatEmpty ? "pb-6" : "flex-1 pb-4"}>
                <ChatConversationView
                  isLoadingSession={isLoadingSession}
                  messages={messages}
                  isLoading={isLoading}
                  hasPersonalSources={hasPersonalSources}
                  sourceStatus={sourceStatus}
                  includeKnowledgeBase={includeKnowledgeBase}
                  isDemo={isDemoMode}
                  isTemporaryChat={isTemporaryChat}
                  onRetryMessage={onRetryMessage}
                  onSendFollowUp={(prompt) => {
                    onSubmit(prompt);
                  }}
                  onOpenUpload={isDemoMode ? undefined : triggerOpenUpload}
                  bottomRef={bottomRef}
                />
              </div>

              <ChatComposerSection
                isDemoMode={isDemoMode}
                isNewChatEmpty={isNewChatEmpty}
                isLoadingSession={isLoadingSession}
                isLoading={isLoading}
                isTemporaryChat={isTemporaryChat}
                hasMessages={messages.length > 0}
                showScrollToBottom={showScrollToBottom}
                scrollToBottom={scrollToBottom}
                onScrollButtonInteractionStart={onScrollButtonInteractionStart}
                onScrollButtonInteractionEnd={onScrollButtonInteractionEnd}
                hasReachedLimit={hasReachedLimit}
                remaining={remaining}
                autocompleteSuggestions={autocompleteSuggestions}
                queuedMessages={queuedMessages}
                focusedDocument={focusedDocument}
                includeKnowledgeBase={includeKnowledgeBase}
                knowledgeBaseCount={knowledgeBaseCount}
                sources={sources}
                selectedSourceIds={selectedSourceIds}
                hasWorkspace={Boolean(workspace)}
                onClearFocusedDocument={clearFocusedDocument}
                onToggleKnowledgeBase={onToggleKnowledgeBase}
                onToggleSourceSelection={onToggleSourceSelection}
                onSetSectionSourcesSelected={onSetSectionSourcesSelected}
                onSetAllSourcesSelected={onSetAllSourcesSelected}
                triggerOpenUpload={triggerOpenUpload}
                uploadDroppedFiles={uploadDroppedFiles}
                onSubmit={onSubmit}
                onRemoveQueuedMessage={onRemoveQueuedMessage}
                onStopResponse={onStopResponse}
                onOpenSignupModal={openSignupModal}
              />
            </div>
          </div>
        </div>
      </div>
      <ChatSurfaceModals
        hasWorkspace={Boolean(workspace)}
        isUploadOpen={isUploadOpen}
        setIsUploadOpen={setIsUploadOpen}
        handleUploadToast={handleUploadToast}
        completedDocumentIds={completedDocumentIds}
        failedDocuments={failedDocuments}
        uploadToasts={uploadToasts}
        dismissToast={dismissToast}
        isLoading={isLoading}
        retrievalMessage={retrievalMessage}
        showSignupModal={showSignupModal}
        setShowSignupModal={setShowSignupModal}
      />
    </div>
  );
}

function ChatLayoutCore({ mode, embedded }: Readonly<ChatLayoutCoreProps>) {
  const isDemoMode = mode === "demo";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useAuth();
  const { hasReachedLimit, decrementQuestion, remaining } = useDemo();
  const { preferences, updatePreference } = usePreferences();
  const workspace = useWorkspaceOptional();
  const includeKnowledgeBase = resolveIncludeKnowledgeBase(mode, workspace, preferences.includeKnowledgeBase);

  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [localTemporaryChat, setLocalTemporaryChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<QueuedChatMessage[]>([]);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const isTemporaryChat = !isDemoMode && (workspace ? workspace.isTemporaryChat : localTemporaryChat);

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeJobIdRef = useRef<string | null>(null);
  const activeSmootherRef = useRef<TextStreamSmoother | null>(null);
  const mountedRef = useRef(true);
  const messagesRef = useRef<ChatMessageType[]>([]);
  const isTemporaryChatRef = useRef(isTemporaryChat);
  const sessionParam = searchParams.get("session");
  const prevSessionParamRef = useRef<string | null>(sessionParam);
  const queuedMessagesRef = useRef<QueuedChatMessage[]>([]);
  const conversationRunRef = useRef(0);
  const isLoadingRef = useRef(false);

  const scrollTracking = useChatScrollTracking(messages, preferences.autoScrollOnStream);

  const setWorkspaceTemporaryChatRef = useRef(workspace?.setIsTemporaryChat);

  useEffect(() => {
    setWorkspaceTemporaryChatRef.current = workspace?.setIsTemporaryChat;
  }, [workspace?.setIsTemporaryChat]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeSmootherRef.current?.stop();
      activeSmootherRef.current = null;
      setWorkspaceTemporaryChatRef.current?.(false);
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    isTemporaryChatRef.current = isTemporaryChat;
  }, [isTemporaryChat]);

  useEffect(() => {
    queuedMessagesRef.current = queuedMessages;
  }, [queuedMessages]);

  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  const localKnowledge = useKnowledgeSources({ demo: isDemoMode, isLoaded, isSignedIn });
  const { sources, sourceStatus, deletingSourceId, handleDeleteSource } = resolveWorkspaceSourceBindings(
    isDemoMode,
    workspace,
    localKnowledge,
  );
  const { setPollDocuments, serverAutocompleteSuggestions } = localKnowledge;

  const sourceControls = useChatSourceControls({
    mode,
    workspace,
    sources,
    includeKnowledgeBase,
    updatePreference,
  });

  const uploadActions = useChatUploadActions({
    isDemoMode,
    workspace,
    userId: user?.id,
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    completedDocumentIds: sourceControls.completedDocumentIds,
    failedDocuments: sourceControls.failedDocuments,
    setPollDocuments,
    setShowSignupModal,
  });

  const handleClearMessages = useCallback(() => {
    setMessages([]);
    setQueuedMessages([]);
    queuedMessagesRef.current = [];
  }, []);

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
    demo: isDemoMode,
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
    if (workspace && !isDemoMode) {
      await workspace.refreshRecentChats();
    }
  }, [isDemoMode, localRefreshRecentChats, workspace]);

  const { isChatFileDragging, dragProps } = useChatDragAndDrop(isDemoMode, uploadActions.uploadDroppedFiles);

  const sourceGroups = useMemo(() => createSourceGroups(sources), [sources]);
  const recentChats = useMemo(
    () => buildRecentChatItems(recentSessionRows, activeSessionId),
    [activeSessionId, recentSessionRows],
  );

  const retrievalMessage = getRetrievalStatusMessage({
    isLoading,
    hasStartedAnswer: hasAssistantStartedAnswer(messages),
    includeKnowledgeBase,
  });

  const filteredServerAutocompleteSuggestions = useMemo(
    () =>
      filterSuggestionsForScope(
        serverAutocompleteSuggestions,
        includeKnowledgeBase,
        sourceControls.knowledgeBaseDocumentIds,
      ),
    [includeKnowledgeBase, sourceControls.knowledgeBaseDocumentIds, serverAutocompleteSuggestions],
  );

  const autocompleteSuggestions = useMemo<AutocompleteSuggestion[]>(
    () => buildCombinedAutocompleteSuggestions(filteredServerAutocompleteSuggestions, messages),
    [filteredServerAutocompleteSuggestions, messages],
  );

  const focusedDocument = workspace?.focusedDocument ?? null;

  const { runQuestion } = useChatQuestionRunner({
    mode,
    workspace,
    includeKnowledgeBase,
    focusedDocument,
    knowledgeBaseDocumentIds: sourceControls.knowledgeBaseDocumentIds,
    hasExcludedSources: sourceControls.hasExcludedSources,
    selectedSourceIds: sourceControls.selectedSourceIds,
    mountedRef,
    messagesRef,
    isTemporaryChatRef,
    isLoadingSessionRef,
    isLoadingRef,
    conversationRunRef,
    abortControllerRef,
    activeJobIdRef,
    activeSmootherRef,
    activeSessionIdRef,
    loadedSessionRef,
    queuedMessagesRef,
    setMessages,
    setIsLoading,
    setQueuedMessages,
    setActiveSessionId,
    setRecentSessionRows,
    refreshRecentChats,
    pinToBottomForNewTurn: scrollTracking.pinToBottomForNewTurn,
  });

  const submissionActions = useChatSubmissionActions({
    isDemoMode,
    hasReachedLimit,
    decrementQuestion,
    setShowSignupModal,
    messages,
    setMessages,
    setQueuedMessages,
    isLoadingRef,
    isLoadingSessionRef,
    queuedMessagesRef,
    conversationRunRef,
    abortControllerRef,
    activeJobIdRef,
    runQuestion,
  });

  const resetActions = useChatConversationReset({
    isDemoMode,
    workspace,
    conversationRunRef,
    activeSmootherRef,
    abortControllerRef,
    activeJobIdRef,
    isLoadingRef,
    isLoadingSessionRef,
    isTemporaryChatRef,
    activeSessionIdRef,
    messagesRef,
    queuedMessagesRef,
    loadedSessionRef,
    setLocalTemporaryChat,
    setIsLoadingSession,
    setIsLoading,
    setActiveSessionId,
    setMessages,
    setQueuedMessages,
  });

  useWorkspaceSessionLifecycle({
    mode,
    workspace,
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    hasUser: Boolean(user),
    sessionParam,
    activeSessionId,
    activeSessionIdRef,
    prevSessionParamRef,
    conversationRunRef,
    abortControllerRef,
    activeJobIdRef,
    queuedMessagesRef,
    setTemporaryChat: resetActions.setTemporaryChat,
    setMessages,
    setQueuedMessages,
    setRecentSessionRows,
    handleNewChat: resetActions.handleNewChat,
    handleToggleTemporaryChat: resetActions.handleToggleTemporaryChat,
    router,
  });

  if (!isAuthorizedToRenderChat(mode, isLoaded, Boolean(isSignedIn), Boolean(user))) {
    return null;
  }

  const chatContent = (
    <ChatSurfaceView
      isDemoMode={isDemoMode}
      isNewChatEmpty={messages.length === 0 && !isLoadingSession}
      isTemporaryChat={isTemporaryChat}
      isChatFileDragging={isChatFileDragging}
      dragProps={dragProps}
      scrollContainerRef={scrollTracking.scrollContainerRef}
      bottomRef={scrollTracking.bottomRef}
      handleScroll={scrollTracking.handleScroll}
      handleWheel={scrollTracking.handleWheel}
      handleTouchStart={scrollTracking.handleTouchStart}
      handleTouchMove={scrollTracking.handleTouchMove}
      isLoadingSession={isLoadingSession}
      messages={messages}
      isLoading={isLoading}
      hasPersonalSources={hasPersonalUploadedSources(sources)}
      sourceStatus={sourceStatus}
      includeKnowledgeBase={includeKnowledgeBase}
      showScrollToBottom={scrollTracking.showScrollToBottom}
      scrollToBottom={scrollTracking.scrollToBottom}
      onScrollButtonInteractionStart={scrollTracking.startScrollButtonInteraction}
      onScrollButtonInteractionEnd={scrollTracking.endScrollButtonInteraction}
      hasReachedLimit={hasReachedLimit}
      remaining={remaining}
      autocompleteSuggestions={autocompleteSuggestions}
      queuedMessages={queuedMessages}
      focusedDocument={focusedDocument}
      knowledgeBaseCount={sourceControls.knowledgeBaseCount}
      sources={sources}
      selectedSourceIds={sourceControls.selectedSourceIds}
      workspace={workspace}
      onToggleKnowledgeBase={sourceControls.handleToggleKnowledgeBase}
      onToggleSourceSelection={sourceControls.handleToggleSourceSelection}
      onSetSectionSourcesSelected={sourceControls.handleSetSectionSourcesSelected}
      onSetAllSourcesSelected={sourceControls.handleSetAllSourcesSelected}
      onSubmit={submissionActions.handleSubmit}
      onRetryMessage={submissionActions.handleRetryMessage}
      onRemoveQueuedMessage={submissionActions.handleRemoveQueuedMessage}
      onStopResponse={submissionActions.handleStopResponse}
      onToggleTemporaryChat={resetActions.handleToggleTemporaryChat}
      triggerOpenUpload={uploadActions.triggerOpenUpload}
      uploadDroppedFiles={uploadActions.uploadDroppedFiles}
      isUploadOpen={uploadActions.isUploadOpen}
      setIsUploadOpen={uploadActions.setIsUploadOpen}
      handleUploadToast={uploadActions.handleUploadToast}
      completedDocumentIds={sourceControls.completedDocumentIds}
      failedDocuments={sourceControls.failedDocuments}
      uploadToasts={uploadActions.uploadToasts}
      dismissToast={uploadActions.dismissToast}
      retrievalMessage={retrievalMessage}
      showSignupModal={showSignupModal}
      setShowSignupModal={setShowSignupModal}
    />
  );

  if (isDemoMode) {
    return (
      <div
        style={{ backgroundColor: "var(--chat-workspace-bg, #0a0e22)" }}
        className="chat-workspace-surface flex h-dvh flex-col overflow-clip bg-[#0a0e22] text-slate-100"
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
      onToggleTemporaryChat={resetActions.handleToggleTemporaryChat}
      onToggleKnowledgeBase={sourceControls.handleToggleKnowledgeBase}
      onDeleteSource={handleDeleteSource}
      onDeleteSession={handleDeleteSession}
      onRenameSession={handleRenameSession}
      onOpenSession={handleOpenSession}
      onNewChat={resetActions.handleNewChat}
      onOpenUpload={uploadActions.triggerOpenUpload}
    >
      {chatContent}
    </AcademicWorkspace>
  );
}

export function ChatLayout({ embedded = false }: Readonly<ChatLayoutProps>) {
  return <ChatLayoutCore mode="workspace" embedded={embedded} />;
}

export function DemoChatLayout() {
  return <ChatLayoutCore mode="demo" embedded={false} />;
}
