import { X } from "lucide-react";

import type { AutocompleteSuggestion } from "../../lib/trie-autocomplete";
import { ChatInput } from "../ChatInput";

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
  onSubmit,
  onRemoveQueuedMessage,
  onStopResponse,
  onOpenUpload,
}: ChatComposerProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-2">
      {queuedMessages.length > 0 && (
        <div className="mx-auto flex max-h-28 w-full max-w-4xl flex-col gap-1 overflow-hidden rounded-xl border border-cyan-300/15 bg-slate-950/85 p-2 text-xs text-slate-300 shadow-xl shadow-cyan-950/10 backdrop-blur-xl">
          {queuedMessages.slice(0, queueLimit).map((message, index) => (
            <div key={message.id} className="flex min-h-8 items-center gap-2 rounded-lg bg-white/[0.04] px-2">
              <span className="shrink-0 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-cyan-200/80">
                Queued {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-slate-300">{message.question}</span>
              {onRemoveQueuedMessage && (
                <button
                  type="button"
                  onClick={() => onRemoveQueuedMessage(message.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  aria-label="Remove queued message"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <ChatInput
        autocompleteSuggestions={autocompleteSuggestions}
        disabled={disabled}
        isResponding={isResponding}
        onSubmit={onSubmit}
        onStopResponse={onStopResponse}
        onOpenUpload={onOpenUpload}
      />
    </div>
  );
}
