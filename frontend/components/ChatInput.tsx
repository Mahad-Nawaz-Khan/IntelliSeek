"use client";

import { GitBranch, Plus, Send, Square } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { type AutocompleteSuggestion, TrieAutocomplete } from "../lib/trie-autocomplete";

type ChatInputProps = {
  autocompleteSuggestions?: AutocompleteSuggestion[];
  disabled?: boolean;
  isResponding?: boolean;
  onSubmit: (question: string, selectedSuggestion?: AutocompleteSuggestion) => boolean;
  onStopResponse?: () => void;
  onOpenUpload?: () => void;
};

export function ChatInput({
  autocompleteSuggestions = [],
  disabled = false,
  isResponding = false,
  onSubmit,
  onStopResponse,
  onOpenUpload,
}: ChatInputProps) {
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
  const boundedHighlightedIndex = highlightedIndex === null || !matches.length
    ? null
    : Math.min(highlightedIndex, matches.length - 1);
  const isAutocompleteOpen = !isAutocompleteDismissed && matches.length > 0;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);


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

    const accepted = onSubmit(question, selectedSuggestion?.value.trim() === question ? selectedSuggestion : undefined);
    if (!accepted) return false;
    setValue("");
    setSelectedSuggestion(undefined);
    setIsAutocompleteDismissed(false);
    setHighlightedIndex(null);
    return true;
  }

  return (
    <div className="relative min-h-16 w-full place-self-center rounded-full border border-white/10 bg-slate-950/70 p-2 shadow-[0_18px_45px_rgba(0,0,0,0.38)] backdrop-blur-xl transition-[border-color,box-shadow] focus-within:border-cyan-400/50 focus-within:shadow-[0_20px_55px_rgba(8,145,178,0.22)] lg:w-200">
      {isAutocompleteOpen && matches.length > 0 && (
        <div className="absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
            <GitBranch className="h-3.5 w-3.5" />
            Trie autocomplete
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {matches.map((match, index) => (
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
                <span className="truncate">{match.label}</span>
                <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">
                  {match.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mx-0.5 flex items-end">
        {onOpenUpload && (
          <button
            type="button"
            onClick={onOpenUpload}
            disabled={disabled}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-transparent border-none text-slate-300 transition hover:bg-white/[0.12] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            aria-label="Upload document"
          >
            <Plus className="h-6 w-6" strokeWidth={2.5} />
          </button>
        )}
        <div className="relative min-w-0 flex-1">
          {!value && (
            <span className="pointer-events-none absolute inset-x-3 top-3 truncate text-sm leading-6 text-slate-500">
              Ask IntelliSeek about your uploaded material...
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
                setHighlightedIndex((current) => current === null ? 0 : (current + 1) % matches.length);
                return;
              }

              if (event.key === "ArrowUp" && isAutocompleteOpen && matches.length > 0) {
                event.preventDefault();
                setHighlightedIndex((current) =>
                  current === null || current === 0 ? matches.length - 1 : current - 1,
                );
                return;
              }

              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (isAutocompleteOpen && boundedHighlightedIndex !== null && matches[boundedHighlightedIndex]) {
                  selectSuggestion(matches[boundedHighlightedIndex]);
                  return;
                }
                submit();
              }
            }}
            className="max-h-40 min-h-12 w-full resize-none bg-transparent px-3 py-3 text-sm leading-6 text-slate-100 outline-none disabled:cursor-not-allowed disabled:opacity-60"
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
          className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          aria-label={isResponding ? "Stop response" : "Send question"}
        >
          {isResponding ? <Square className="h-4 w-4 fill-current" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
