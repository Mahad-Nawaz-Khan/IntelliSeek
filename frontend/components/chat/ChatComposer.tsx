import type { AutocompleteSuggestion } from "../../lib/trie-autocomplete";
import { ChatInput } from "../ChatInput";

type ChatComposerProps = {
  autocompleteSuggestions: AutocompleteSuggestion[];
  disabled?: boolean;
  onSubmit: (question: string) => void;
};

export function ChatComposer({
  autocompleteSuggestions,
  disabled = false,
  onSubmit,
}: ChatComposerProps) {
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-slate-500">Ask anything about your notes.</p>
      <ChatInput
        autocompleteSuggestions={autocompleteSuggestions}
        disabled={disabled}
        onSubmit={onSubmit}
      />
    </div>
  );
}
