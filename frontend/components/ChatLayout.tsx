"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AcademicWorkspace } from "./chat/AcademicWorkspace";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessage } from "./chat/ChatMessage";
import { ChatWelcome } from "./chat/ChatWelcome";
import { SUGGESTIONS } from "./SuggestedQueries";
import { UploadModal } from "./upload/UploadModal";
import { useAuth } from "../context/AuthContext";
import { streamChatQuestion, type ChatMessage as ChatMessageType } from "../lib/chat-api";
import type { AutocompleteSuggestion } from "../lib/trie-autocomplete";
import {
  createRecentChats,
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
  const { isLoaded, isSignedIn, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [serverAutocompleteSuggestions, setServerAutocompleteSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">(
    "loading",
  );
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [pollDocuments, setPollDocuments] = useState(false);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const completedDocumentIds = useMemo(
    () => new Set(sources.filter((source) => source.status === "indexed").map((source) => source.id)),
    [sources],
  );
  const failedDocuments = useMemo(
    () => new Map(sources.filter((source) => source.status === "failed").map((source) => [source.id, source.summary ?? "Indexing failed"])),
    [sources],
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const sourceGroups = useMemo(() => createSourceGroups(sources), [sources]);
  const recentChats = useMemo(() => createRecentChats(messages), [messages]);
  const retrievalMatches = useMemo(() => toRetrievalMatches(messages), [messages]);
  const retrievalStatus = useMemo<RetrievalStatus>(() => {
    if (isLoading) {
      return {
        state: "retrieving",
        message: "Retrieving relevant sources...",
        matches: sources.slice(0, 3).map((source) => ({
          id: source.id,
          sourceId: source.id,
          filename: source.filename,
          locator: source.fileType?.toUpperCase(),
          snippet: source.summary,
        })),
      };
    }

    return { state: "complete", message: "Sources ready", matches: retrievalMatches };
  }, [isLoading, retrievalMatches, sources]);

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

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !user) {
      setSources([]);
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

    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, router, user]);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    async (question: string) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || isLoading) return;

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

      let streamedAnswer = "";

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
          },
        });
      } catch (error) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
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
        setIsLoading(false);
      }
    },
    [isLoading],
  );

  const handleNewChat = useCallback(() => {
    setMessages([]);
  }, []);

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
      onDeleteSource={handleDeleteSource}
      onNewChat={handleNewChat}
    >
      <ChatHeader onOpenUpload={() => setIsUploadOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <ChatWelcome disabled={isLoading} onSelect={handleSubmit} />
            ) : (
              <div className="mx-auto max-w-5xl space-y-5">
                {isLoading && retrievalStatus.matches?.length ? (
                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/8 p-3 text-sm text-cyan-50">
                    Retrieving relevant sources...
                  </div>
                ) : null}
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-4 sm:p-6">
            <ChatComposer
              autocompleteSuggestions={autocompleteSuggestions}
              disabled={isLoading}
              onOpenUpload={() => setIsUploadOpen(true)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onQueued={() => setPollDocuments(true)}
        completedDocumentIds={completedDocumentIds}
        failedDocuments={failedDocuments}
      />
    </AcademicWorkspace>
  );
}
