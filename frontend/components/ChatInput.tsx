"use client";

import { BookOpen, Clock, FileText, GitBranch, Plus, Send, Sparkles, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { usePreferences } from "../lib/preferences";
import { type AutocompleteSuggestion, TrieAutocomplete } from "../lib/trie-autocomplete";

const TYPE_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  topic: {
    label: "Topic",
    badgeClass: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    icon: Sparkles,
  },
  document: {
    label: "Document",
    badgeClass: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    icon: FileText,
  },
  history: {
    label: "Recent",
    badgeClass: "border-purple-500/30 bg-purple-500/10 text-purple-300",
    icon: Clock,
  },
  prompt: {
    label: "Suggested",
    badgeClass: "border-slate-500/30 bg-slate-500/10 text-slate-400",
    icon: BookOpen,
  },
};

function highlightMatch(label: string, query: string) {
  const trimmed = query.trim();
  if (!trimmed) return label;

  const tokens = trimmed
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  if (!tokens.length) return label;

  const escaped = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = label.split(regex);

  return parts.map((part, i) => {
    if (tokens.some((t) => t.toLowerCase() === part.toLowerCase())) {
      return (
        <span key={i} className="font-semibold text-cyan-200">
          {part}
        </span>
      );
    }
    return part;
  });
}

type ChatInputProps = {
  autocompleteSuggestions?: AutocompleteSuggestion[];
  disabled?: boolean;
  isResponding?: boolean;
  focusedDocumentName?: string | null;
  includeKnowledgeBase?: boolean;
  onSubmit: (question: string, selectedSuggestion?: AutocompleteSuggestion) => boolean;
  onStopResponse?: () => void;
  onOpenUpload?: () => void;
};

export function ChatInput({
  autocompleteSuggestions = [],
  disabled = false,
  isResponding = false,
  focusedDocumentName = null,
  includeKnowledgeBase = true,
  onSubmit,
  onStopResponse,
  onOpenUpload,
}: Readonly<ChatInputProps>) {
  const { preferences } = usePreferences();
  const [value, setValue] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<AutocompleteSuggestion | undefined>();
  const [isAutocompleteDismissed, setIsAutocompleteDismissed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trie = useMemo(
    () => TrieAutocomplete.fromSuggestions(autocompleteSuggestions),
    [autocompleteSuggestions],
  );
  const matches = useMemo(() => {
    const query = value.trim();
    if (query.length < 2 || disabled) return [];
    return trie.search(query, 6);
  }, [disabled, trie, value]);
  const boundedHighlightedIndex =
    highlightedIndex === null || !matches.length
      ? null
      : Math.min(highlightedIndex, matches.length - 1);
  const isAutocompleteOpen = !isAutocompleteDismissed && matches.length > 0;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [value]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (disabled || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isEditable) return;

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [disabled]);

  function selectSuggestion(suggestion: AutocompleteSuggestion) {
    setValue(suggestion.value);
    setSelectedSuggestion(suggestion);
    setIsAutocompleteDismissed(true);
    setHighlightedIndex(null);
    textareaRef.current?.focus();
  }

  function submit() {
    const question = value.trim();
    if (!question || disabled) return false;

    const accepted = onSubmit(
      question,
      selectedSuggestion?.value.trim() === question ? selectedSuggestion : undefined,
    );
    if (!accepted) return false;
    setValue("");
    setSelectedSuggestion(undefined);
    setIsAutocompleteDismissed(false);
    setHighlightedIndex(null);
    return true;
  }

  const placeholderText = focusedDocumentName
    ? `Ask about ${focusedDocumentName}...`
    : includeKnowledgeBase
      ? "Ask IntelliSeek about your uploaded material... (Press / to focus)"
      : "Ask only from your uploaded documents... (Press / to focus)";

  return (
    <div
      style={{ backgroundColor: "var(--chat-input-bg, #161f33)" }}
      className="chat-input-surface relative mx-auto w-full max-w-4xl place-self-center rounded-[26px] border border-white/10 bg-[#161f33] p-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.34)] transition-[border-color] focus-within:border-cyan-400/50"
    >
      {isAutocompleteOpen && matches.length > 0 && (
        <div className="absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
            <span className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5" />
              Trie autocomplete
            </span>
            <span className="text-[0.65rem] tracking-normal text-slate-500 normal-case">
              ↑↓ to navigate • Enter to select • Esc to dismiss
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {matches.map((match, index) => {
              const typeInfo = TYPE_CONFIG[match.type] ?? TYPE_CONFIG.prompt;
              const Icon = typeInfo.icon;
              return (
                <button
                  key={match.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSuggestion(match)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                    boundedHighlightedIndex === index
                      ? "bg-cyan-300/15 text-cyan-50"
                      : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{highlightMatch(match.label, value)}</span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.16em] ${typeInfo.badgeClass}`}
                  >
                    {typeInfo.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-end gap-1.5">
        {onOpenUpload && (
          <button
            type="button"
            onClick={onOpenUpload}
            disabled={disabled}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-transparent text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            aria-label="Upload document"
            title="Upload document"
          >
            <Plus className="h-5 w-5" strokeWidth={2.25} />
          </button>
        )}
        <div className="relative min-w-0 flex-1">
          {!value && (
            <span
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-sm leading-5 text-slate-400 ${
                onOpenUpload ? "inset-x-2" : "left-3.5 right-2"
              }`}
            >
              {placeholderText}
            </span>
          )}
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            disabled={disabled}
            aria-label="Ask IntelliSeek about your uploaded material"
            onChange={(event) => {
              setValue(event.target.value);
              setSelectedSuggestion(undefined);
              setIsAutocompleteDismissed(false);
              setHighlightedIndex(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && isAutocompleteOpen) {
                event.preventDefault();
                setIsAutocompleteDismissed(true);
                return;
              }

              if (event.key === "ArrowDown" && isAutocompleteOpen && matches.length > 0) {
                event.preventDefault();
                setHighlightedIndex((current) => (current === null ? 0 : (current + 1) % matches.length));
                return;
              }

              if (event.key === "ArrowUp" && isAutocompleteOpen && matches.length > 0) {
                event.preventDefault();
                setHighlightedIndex((current) =>
                  current === null || current === 0 ? matches.length - 1 : current - 1,
                );
                return;
              }

              if (event.key === "Enter") {
                if (isAutocompleteOpen && boundedHighlightedIndex !== null && matches[boundedHighlightedIndex] && !event.shiftKey) {
                  event.preventDefault();
                  selectSuggestion(matches[boundedHighlightedIndex]);
                  return;
                }

                const shouldSend = preferences.sendOnEnter
                  ? !event.shiftKey
                  : event.ctrlKey || event.metaKey;

                if (shouldSend) {
                  event.preventDefault();
                  submit();
                }
              }
            }}
            className={`block max-h-36 min-h-9 w-full resize-none bg-transparent py-2 text-sm leading-5 text-slate-100 outline-hidden disabled:cursor-not-allowed disabled:opacity-60 ${
              onOpenUpload ? "px-2" : "pl-3.5 pr-2"
            }`}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (isResponding) {
              onStopResponse?.();
              return;
            }

            submit();
          }}
          disabled={disabled || (!isResponding && !value.trim())}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          aria-label={isResponding ? "Stop response" : "Send question"}
          title={isResponding ? "Stop response" : "Send question"}
        >
          {isResponding ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
