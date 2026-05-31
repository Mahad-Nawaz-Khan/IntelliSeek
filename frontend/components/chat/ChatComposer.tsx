import type { AutocompleteSuggestion } from "../../lib/trie-autocomplete";
import { ChatInput } from "../ChatInput";

type ChatComposerProps = {
  autocompleteSuggestions: AutocompleteSuggestion[];
  disabled?: boolean;
  onSubmit: (question: string) => void;
  onOpenUpload?: () => void;
};

export function ChatComposer({
  autocompleteSuggestions,
  disabled = false,
  onSubmit,
  onOpenUpload,
}: ChatComposerProps) {
  return (
    <div>
      <ChatInput
        autocompleteSuggestions={autocompleteSuggestions}
        disabled={disabled}
        onSubmit={onSubmit}
        onOpenUpload={onOpenUpload}
      />
    </div>
  );
}
