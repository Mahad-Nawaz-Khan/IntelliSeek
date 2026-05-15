"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AcademicWorkspace } from "./chat/AcademicWorkspace";
import { ChatComposer } from "./chat/ChatComposer";
import { ChatHeader } from "./chat/ChatHeader";
import { ChatMessage } from "./chat/ChatMessage";
import { ChatWelcome } from "./chat/ChatWelcome";
import { SUGGESTIONS } from "./SuggestedQueries";
import { UploadModal } from "./upload/UploadModal";
import { hasSupabasePublicConfig, supabase } from "../lib/supabase";
import { type ChatMessage as ChatMessageType, submitChatQuestion } from "../lib/chat-api";
import type { AutocompleteSuggestion } from "../lib/trie-autocomplete";
import {
  createRecentChats,
  createSourceGroups,
  getFileType,
  type KnowledgeSource,
  type RetrievalMatch,
  type RetrievalStatus,
} from "../lib/ui-state";

const DEMO_USER_ID = "demo-user";

type SupabaseKnowledgeSource = {
  id: string;
  filename: string;
  created_at?: string;
};

function toAutocompleteId(input: string) {
  return input.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function toUploadedSource(source: SupabaseKnowledgeSource): KnowledgeSource {
  return {
    id: source.id,
    filename: source.filename,
    sourceType: "uploaded",
    fileType: getFileType(source.filename),
    status: "indexed",
    createdAt: source.created_at,
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
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">(
    "loading",
  );
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const revealIntervalsRef = useRef<Map<string, number>>(new Map());

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

    const documentSuggestions = sources.flatMap((source) => {
      const filename = source.filename.trim();
      if (!filename) return [];

      return [
        `Summarize ${filename}`,
        `What topics are covered in ${filename}?`,
        `Explain key concepts from ${filename}`,
      ].map((question) => ({
        id: `document-${source.id}-${toAutocompleteId(question)}`,
        label: question,
        value: question,
        type: "document" as const,
      }));
    });

    const historySuggestions = messages
      .filter((message) => message.role === "user")
      .slice(-5)
      .map((message) => ({
        id: `history-${message.id}`,
        label: message.content,
        value: message.content,
        type: "history" as const,
      }));

    return [...promptSuggestions, ...documentSuggestions, ...historySuggestions];
  }, [messages, sources]);

  useEffect(() => {
    let active = true;

    async function loadSources() {
      if (!hasSupabasePublicConfig() || !supabase) {
        setSourceStatus("unavailable");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("documents")
          .select("id, filename, created_at")
          .order("created_at", { ascending: false })
          .limit(8);

        if (!active) return;

        if (error) {
          setSourceStatus("unavailable");
          return;
        }

        const rows = ((data ?? []) as SupabaseKnowledgeSource[]).map(toUploadedSource);
        setSources(rows);
        setSourceStatus(rows.length ? "ready" : "empty");
      } catch {
        if (active) setSourceStatus("unavailable");
      }
    }

    loadSources();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const intervals = revealIntervalsRef.current;
    return () => {
      intervals.forEach((interval) => window.clearInterval(interval));
      intervals.clear();
    };
  }, []);

  const revealAnswer = useCallback((messageId: string, answer: string) => {
    const existingInterval = revealIntervalsRef.current.get(messageId);
    if (existingInterval) window.clearInterval(existingInterval);

    let index = 0;
    const step = Math.max(2, Math.ceil(answer.length / 90));

    const interval = window.setInterval(() => {
      index = Math.min(answer.length, index + step);
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, displayedContent: answer.slice(0, index) }
            : message,
        ),
      );

      if (index >= answer.length) {
        window.clearInterval(interval);
        revealIntervalsRef.current.delete(messageId);
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, content: answer, displayedContent: undefined, status: "complete" }
              : message,
          ),
        );
      }
    }, 18);

    revealIntervalsRef.current.set(messageId, interval);
  }, []);

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

      try {
        const response = await submitChatQuestion(trimmedQuestion, DEMO_USER_ID);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: response.answer,
                  displayedContent: "",
                  sources: response.sources,
                }
              : message,
          ),
        );
        revealAnswer(assistantId, response.answer);
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
                  status: "error",
                }
              : message,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, revealAnswer],
  );

  const handleNewChat = useCallback(() => {
    revealIntervalsRef.current.forEach((interval) => window.clearInterval(interval));
    revealIntervalsRef.current.clear();
    setMessages([]);
  }, []);

  return (
    <AcademicWorkspace
      groups={sourceGroups}
      recentChats={recentChats}
      sourceStatus={sourceStatus}
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
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </AcademicWorkspace>
  );
}
