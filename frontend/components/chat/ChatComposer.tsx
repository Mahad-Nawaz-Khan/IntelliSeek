import { Database, FileText, Sparkles, X } from "lucide-react";

import type { AutocompleteSuggestion } from "../../lib/trie-autocomplete";
import { ChatInput } from "../ChatInput";
import type { FocusedDocument } from "../workspace/WorkspaceShell";

type QueuedChatMessage = {
  id: string;
  question: string;
  createdAt: number;
};

type ChatComposerProps = {
  autocompleteSuggestions: AutocompleteSuggestion[];
  disabled?: boolean;
  isResponding?: boolean;
  queuedMessages?: QueuedChatMessage[];
  queueLimit?: number;
  focusedDocument?: FocusedDocument | null;
  includeKnowledgeBase?: boolean;
  knowledgeBaseCount?: number;
  onToggleKnowledgeBase?: () => void;
  onClearFocusedDocument?: () => void;
  onSubmit: (question: string, selectedSuggestion?: AutocompleteSuggestion) => boolean;
  onRemoveQueuedMessage?: (queuedMessageId: string) => void;
  onStopResponse?: () => void;
  onOpenUpload?: () => void;
};

export function ChatComposer({
  autocompleteSuggestions,
  disabled = false,
  isResponding = false,
  queuedMessages = [],
  queueLimit = 3,
  focusedDocument = null,
  includeKnowledgeBase = true,
  knowledgeBaseCount,
  onToggleKnowledgeBase,
  onClearFocusedDocument,
  onSubmit,
  onRemoveQueuedMessage,
  onStopResponse,
  onOpenUpload,
}: Readonly<ChatComposerProps>) {
  const triggerScopedPrompt = (promptText: string) => {
    if (!focusedDocument || disabled) return;
    onSubmit(promptText, {
      id: `doc-scope-${focusedDocument.id}`,
      label: promptText,
      value: promptText,
      type: "document",
      metadata: {
        source: "uploaded",
        kind: "document",
        documentId: focusedDocument.id,
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-1.5">
      {focusedDocument && (
        <div className="mx-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cyan-300/25 bg-slate-950/90 px-3.5 py-2 text-xs text-cyan-50 shadow-xl shadow-cyan-950/20 backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-300/15 text-cyan-300">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-cyan-300">Scoped to</span>
            <span className="max-w-52 truncate font-medium text-white sm:max-w-72" title={focusedDocument.filename}>
              {focusedDocument.filename}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => triggerScopedPrompt(`Summarize the key points and main takeaways of ${focusedDocument.filename}.`)}
              className="inline-flex items-center gap-1 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[0.7rem] font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              Summarize
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => triggerScopedPrompt(`What are the core concepts and definitions covered in ${focusedDocument.filename}?`)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Key concepts
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => triggerScopedPrompt(`Create 3 study practice questions with answers based on ${focusedDocument.filename}.`)}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
            >
              Practice quiz
            </button>
            {onClearFocusedDocument && (
              <button
                type="button"
                onClick={onClearFocusedDocument}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Clear focused document"
                title="Search all documents"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {queuedMessages.length > 0 && (
        <div className="mx-auto flex max-h-28 w-full flex-col gap-1 overflow-hidden rounded-2xl border border-cyan-300/15 bg-slate-950/80 p-2 text-xs text-slate-300 shadow-xl shadow-cyan-950/10 backdrop-blur-xl">
          {queuedMessages.slice(0, queueLimit).map((message, index) => (
            <div key={message.id} className="flex min-h-7 items-center gap-2 rounded-xl bg-white/5 px-2">
              <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-cyan-200/80">
                Queued {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-300">{message.question}</span>
              {onRemoveQueuedMessage && (
                <button
                  type="button"
                  onClick={() => onRemoveQueuedMessage(message.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  aria-label="Remove queued message"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {onToggleKnowledgeBase && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <button
            type="button"
            role="switch"
            aria-checked={includeKnowledgeBase}
            disabled={disabled}
            onClick={onToggleKnowledgeBase}
            aria-label={
              includeKnowledgeBase
                ? "Knowledge Base enabled — turn off to use only your uploaded documents"
                : "Knowledge Base disabled — turn on to include Knowledge Base documents"
            }
            title={
              includeKnowledgeBase
                ? "Knowledge Base context is ON (click to use only your uploaded docs)"
                : "Knowledge Base context is OFF — answering from your uploaded docs only (click to turn on)"
            }
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium shadow-lg backdrop-blur-xl transition-all active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 ${
              includeKnowledgeBase
                ? "border-cyan-300/30 bg-slate-950/85 text-cyan-100 hover:border-cyan-300/50 hover:bg-slate-900/95"
                : "border-amber-300/30 bg-slate-950/85 text-amber-100 hover:border-amber-300/50 hover:bg-slate-900/95"
            }`}
          >
            <Database
              className={`h-3.5 w-3.5 shrink-0 transition ${
                includeKnowledgeBase ? "text-cyan-300" : "text-amber-300"
              }`}
            />
            <span>Knowledge Base</span>
            {typeof knowledgeBaseCount === "number" && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none ${
                  includeKnowledgeBase
                    ? "bg-cyan-300/15 text-cyan-200"
                    : "bg-white/10 text-slate-400"
                }`}
              >
                {knowledgeBaseCount}
              </span>
            )}
            <span
              className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border transition-colors duration-200 ${
                includeKnowledgeBase
                  ? "border-cyan-300/50 bg-cyan-400"
                  : "border-white/15 bg-slate-800/80"
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 transform rounded-full transition-transform duration-200 ${
                  includeKnowledgeBase ? "translate-x-3.5 bg-slate-950" : "translate-x-0.5 bg-slate-300"
                }`}
              />
            </span>
            <span
              className={`text-[0.68rem] font-semibold uppercase tracking-wider ${
                includeKnowledgeBase ? "text-cyan-300" : "text-amber-300"
              }`}
            >
              {includeKnowledgeBase ? "On" : "Off"}
            </span>
          </button>

          {!includeKnowledgeBase && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-slate-950/85 px-2.5 py-0.5 text-[0.7rem] text-slate-300 shadow-lg backdrop-blur-xl">
              <FileText className="h-3 w-3 text-cyan-300" />
              Your uploaded docs only
            </span>
          )}
        </div>
      )}

      <ChatInput
        autocompleteSuggestions={autocompleteSuggestions}
        disabled={disabled}
        isResponding={isResponding}
        focusedDocumentName={focusedDocument?.filename}
        includeKnowledgeBase={includeKnowledgeBase}
        onSubmit={onSubmit}
        onStopResponse={onStopResponse}
        onOpenUpload={onOpenUpload}
      />
    </div>
  );
}
