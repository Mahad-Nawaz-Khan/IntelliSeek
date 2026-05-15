"use client";

import { BookOpen, Database, GraduationCap, PanelLeft } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChatInput } from "./ChatInput";
import { FileUpload } from "./FileUpload";
import { MessageBubble } from "./MessageBubble";
import { SuggestedQueries } from "./SuggestedQueries";
import { hasSupabasePublicConfig, supabase } from "../lib/supabase";
import { type ChatMessage, submitChatQuestion } from "../lib/chat-api";

const DEMO_USER_ID = "demo-user";

type KnowledgeSource = {
  id: string;
  filename: string;
  created_at?: string;
};

export function ChatLayout() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourceStatus, setSourceStatus] = useState<"loading" | "ready" | "empty" | "unavailable">(
    "loading",
  );
  const bottomRef = useRef<HTMLDivElement>(null);

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

        const rows = (data ?? []) as KnowledgeSource[];
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

  const revealAnswer = useCallback((messageId: string, answer: string) => {
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
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, content: answer, displayedContent: undefined, status: "complete" }
              : message,
          ),
        );
      }
    }, 18);
  }, []);

  const handleSubmit = useCallback(
    async (question: string) => {
      const trimmedQuestion = question.trim();
      if (!trimmedQuestion || isLoading) return;

      const now = Date.now();
      const userMessage: ChatMessage = {
        id: `user-${now}`,
        role: "user",
        content: trimmedQuestion,
        status: "complete",
        createdAt: now,
      };
      const assistantId = `assistant-${now}`;
      const assistantPlaceholder: ChatMessage = {
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

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#164e63_0%,transparent_32%),linear-gradient(135deg,#020617_0%,#0f172a_45%,#111827_100%)] text-slate-100">
      <div className="flex min-h-screen flex-col gap-4 p-4 lg:flex-row lg:p-6">
        <aside className="flex w-full flex-col gap-4 rounded-[2rem] border border-white/10 bg-slate-950/55 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:max-h-[calc(100vh-3rem)] lg:w-96 lg:overflow-y-auto">
          <header className="rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">
                  IntelliSeek
                </p>
                <h1 className="text-xl font-semibold text-white">Academic AI Assistant</h1>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Ask grounded questions over your uploaded notes, slides, PDFs, and text files.
            </p>
          </header>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
              <PanelLeft className="h-4 w-4 text-cyan-200" />
              Upload material
            </div>
            <FileUpload />
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Database className="h-4 w-4 text-cyan-200" />
                Knowledge sources
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-400">
                {sources.length}
              </span>
            </div>
            <SourceList status={sourceStatus} sources={sources} />
          </section>
        </aside>

        <section className="flex min-h-[70vh] flex-1 flex-col rounded-[2rem] border border-white/10 bg-slate-950/45 shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:max-h-[calc(100vh-3rem)]">
          <header className="border-b border-white/10 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Chat with your sources</h2>
                <p className="text-sm text-slate-400">
                  Stateless questions, cited answers, and local session history.
                </p>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            {messages.length === 0 ? (
              <div className="flex min-h-full items-center justify-center py-16">
                <SuggestedQueries disabled={isLoading} onSelect={handleSubmit} />
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-4 sm:p-6">
            <ChatInput disabled={isLoading} onSubmit={handleSubmit} />
          </div>
        </section>
      </div>
    </main>
  );
}

type SourceListProps = {
  status: "loading" | "ready" | "empty" | "unavailable";
  sources: KnowledgeSource[];
};

function SourceList({ status, sources }: SourceListProps) {
  if (status === "loading") {
    return <p className="text-sm text-slate-400">Loading sources...</p>;
  }

  if (status === "unavailable") {
    return <p className="text-sm leading-6 text-amber-200/80">Source list unavailable. Chat remains available for indexed documents.</p>;
  }

  if (status === "empty") {
    return <p className="text-sm leading-6 text-slate-400">No uploaded sources found yet. Upload a document to build your knowledge base.</p>;
  }

  return (
    <ul className="space-y-2">
      {sources.map((source) => (
        <li
          key={source.id}
          className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-slate-200"
        >
          <p className="truncate font-medium">{source.filename}</p>
          {source.created_at && (
            <p className="mt-1 text-xs text-slate-500">
              {new Date(source.created_at).toLocaleDateString()}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
