import { Upload } from "lucide-react";

import type { AutocompleteSuggestion } from "../../lib/trie-autocomplete";
import { ChatInput } from "../ChatInput";

type ChatComposerProps = {
  autocompleteSuggestions: AutocompleteSuggestion[];
  disabled?: boolean;
  onOpenUpload: () => void;
  onSubmit: (question: string) => void;
};

export function ChatComposer({
  autocompleteSuggestions,
  disabled = false,
  onOpenUpload,
  onSubmit,
}: ChatComposerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1 text-xs text-slate-500">
        <span>Ask anything about your notes.</span>
        <button
          type="button"
          onClick={onOpenUpload}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </button>
      </div>
      <ChatInput
        autocompleteSuggestions={autocompleteSuggestions}
        disabled={disabled}
        onSubmit={onSubmit}
      />
    </div>
  );
}
