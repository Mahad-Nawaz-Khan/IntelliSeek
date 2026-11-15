"use client";

import {
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Database,
  FileText,
  FolderOpen,
  GitBranch,
  Minus,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { usePreferences } from "../lib/preferences";
import { type AutocompleteSuggestion, TrieAutocomplete } from "../lib/trie-autocomplete";
import { formatSourcesButtonLabel, isSelectableSource, type KnowledgeSource } from "../lib/ui-state";
import { ALLOWED_EXTENSIONS } from "../lib/upload-config";

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
  knowledgeBaseCount?: number;
  isTemporaryChat?: boolean;
  sources?: KnowledgeSource[];
  selectedSourceIds?: string[];
  onToggleKnowledgeBase?: () => void;
  onToggleSourceSelection?: (sourceId: string) => void;
  onSetSectionSourcesSelected?: (sourceType: KnowledgeSource["sourceType"], selected: boolean) => void;
  onSetAllSourcesSelected?: (selected: boolean) => void;
  onSubmit: (question: string, selectedSuggestion?: AutocompleteSuggestion) => boolean;
  onStopResponse?: () => void;
  onOpenUpload?: () => void;
  onUploadFiles?: (files: File[]) => void;
};

export function ChatInput({
  autocompleteSuggestions = [],
  disabled = false,
  isResponding = false,
  focusedDocumentName = null,
  includeKnowledgeBase = true,
  knowledgeBaseCount,
  isTemporaryChat = false,
  sources,
  selectedSourceIds,
  onToggleKnowledgeBase,
  onToggleSourceSelection,
  onSetSectionSourcesSelected,
  onSetAllSourcesSelected,
  onSubmit,
  onStopResponse,
  onOpenUpload,
  onUploadFiles,
}: Readonly<ChatInputProps>) {
  const { preferences } = usePreferences();
  const [value, setValue] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<AutocompleteSuggestion | undefined>();
  const [isAutocompleteDismissed, setIsAutocompleteDismissed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [plusMenuPlacement, setPlusMenuPlacement] = useState<"down" | "up">("down");
  const [isSourcesMenuOpen, setIsSourcesMenuOpen] = useState(false);
  const [sourcesMenuPlacement, setSourcesMenuPlacement] = useState<"down" | "up">("down");
  const [collapsedSections, setCollapsedSections] = useState<Record<KnowledgeSource["sourceType"], boolean>>({
    uploaded: false,
    "knowledge-base": false,
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const sourcesMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasPlusMenu = Boolean(onUploadFiles || onOpenUpload || onToggleKnowledgeBase);
  const hasSourcesMenu = sources !== undefined;

  const {
    selectableSourceCount,
    selectedSourceCount,
    selectedIdSet,
    sourceSections,
    sourcesButtonLabel,
  } = useMemo(() => {
    const allSources = sources ?? [];
    const selectedSet = new Set(
      selectedSourceIds ??
        allSources
          .filter(
            (source) =>
              isSelectableSource(source) &&
              (source.sourceType !== "knowledge-base" || includeKnowledgeBase),
          )
          .map((source) => source.id),
    );
    const selectableAll = allSources.filter(isSelectableSource);
    const selectedSelectable = selectableAll.filter((source) => selectedSet.has(source.id));
    const uploadedSources = allSources.filter((source) => source.sourceType === "uploaded");
    const kbSources = allSources.filter((source) => source.sourceType === "knowledge-base");

    return {
      selectableSourceCount: selectableAll.length,
      selectedSourceCount: selectedSelectable.length,
      selectedIdSet: selectedSet,
      sourceSections: [
        {
          key: "uploaded" as const,
          label: "Your Uploads",
          items: uploadedSources,
          emptyText: "No uploaded documents yet",
        },
        {
          key: "knowledge-base" as const,
          label: "Knowledge Base",
          items: kbSources,
          emptyText: "No knowledge base documents",
        },
      ],
      sourcesButtonLabel: formatSourcesButtonLabel(selectedSelectable.length),
    };
  }, [includeKnowledgeBase, selectedSourceIds, sources]);

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
  const showPlusMenu = hasPlusMenu && isPlusMenuOpen && !disabled && !isAutocompleteOpen;
  const showSourcesMenu = hasSourcesMenu && isSourcesMenuOpen && !disabled && !isAutocompleteOpen;

  useEffect(() => {
    if (!isPlusMenuOpen && !isSourcesMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (isPlusMenuOpen && !plusMenuRef.current?.contains(target)) {
        setIsPlusMenuOpen(false);
      }
      if (isSourcesMenuOpen && !sourcesMenuRef.current?.contains(target)) {
        setIsSourcesMenuOpen(false);
      }
    };

    const handleMenuEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPlusMenuOpen(false);
        setIsSourcesMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleMenuEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleMenuEscape);
    };
  }, [isPlusMenuOpen, isSourcesMenuOpen]);

  const handleTogglePlusMenu = () => {
    if (disabled) return;
    setIsSourcesMenuOpen(false);
    if (isPlusMenuOpen) {
      setIsPlusMenuOpen(false);
      return;
    }

    const rect = plusMenuRef.current?.getBoundingClientRect();
    const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
    setPlusMenuPlacement(spaceBelow >= 230 ? "down" : "up");
    setIsPlusMenuOpen(true);
  };

  const handleToggleSourcesMenu = () => {
    if (disabled) return;
    setIsPlusMenuOpen(false);
    if (isSourcesMenuOpen) {
      setIsSourcesMenuOpen(false);
      return;
    }

    const rect = sourcesMenuRef.current?.getBoundingClientRect();
    const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
    setSourcesMenuPlacement(spaceBelow >= 280 ? "down" : "up");
    setIsSourcesMenuOpen(true);
  };

  const handleToggleSectionCollapse = (sectionKey: KnowledgeSource["sourceType"]) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const handleTriggerFileUpload = () => {
    setIsPlusMenuOpen(false);
    if (onUploadFiles) {
      fileInputRef.current?.click();
      return;
    }
    onOpenUpload?.();
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length > 0) {
      onUploadFiles?.(files);
    }
  };

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
    : isTemporaryChat
      ? "Ask in a temporary chat... (Press / to focus)"
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
        {hasPlusMenu && (
          <div ref={plusMenuRef} className="relative shrink-0">
            {onUploadFiles && (
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.join(",")}
                onChange={handleFileSelection}
                disabled={disabled}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
            )}
            <button
              type="button"
              onClick={handleTogglePlusMenu}
              disabled={disabled}
              aria-expanded={showPlusMenu}
              aria-haspopup="menu"
              aria-label={showPlusMenu ? "Close tools menu" : "Add files and tools"}
              title={showPlusMenu ? "Close menu" : "Add files & tools"}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 ${
                showPlusMenu
                  ? "bg-white/10 text-slate-100"
                  : "bg-transparent text-slate-300 hover:bg-white/10 hover:text-slate-100"
              }`}
            >
              <Plus
                className={`h-5 w-5 transition-transform duration-200 ${showPlusMenu ? "rotate-45" : ""}`}
                strokeWidth={2.25}
              />
            </button>

            {showPlusMenu && (
              <div
                role="menu"
                aria-label="Chat attachments and context tools"
                className={`chat-plus-menu absolute -left-1.5 z-30 w-64 rounded-2xl border border-white/10 p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.48)] ${
                  plusMenuPlacement === "down"
                    ? "top-full mt-3 origin-top-left"
                    : "bottom-full mb-3 origin-bottom-left"
                }`}
              >
                {(onUploadFiles || onOpenUpload) && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleTriggerFileUpload}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-300"
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-slate-300" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium leading-tight">Upload files</div>
                      <div className="mt-0.5 text-[0.7rem] text-slate-400">
                        PDF, DOCX, PPTX, TXT, MD
                      </div>
                    </div>
                  </button>
                )}

                <Link
                  href="/library"
                  role="menuitem"
                  onClick={() => setIsPlusMenuOpen(false)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-300"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-slate-300" />
                  <span className="font-medium">Source library</span>
                </Link>

                {onToggleKnowledgeBase && (
                  <>
                    <div className="my-1.5 border-t border-white/10" />
                    <button
                      type="button"
                      role="switch"
                      aria-checked={includeKnowledgeBase}
                      onClick={onToggleKnowledgeBase}
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-300"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Database
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            includeKnowledgeBase ? "text-cyan-300" : "text-amber-300"
                          }`}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-medium text-slate-100">
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
                          </div>
                          <div className="mt-0.5 text-[0.7rem] text-slate-400">
                            {includeKnowledgeBase ? "Included in answers" : "Your uploaded docs only"}
                          </div>
                        </div>
                      </div>

                      <span
                        aria-hidden="true"
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 ${
                          includeKnowledgeBase
                            ? "border-cyan-400/50 bg-cyan-500"
                            : "border-slate-500/30 bg-slate-600/40"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                            includeKnowledgeBase ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <div className="relative min-w-0 flex-1">
          {!value && (
            <span
              className={`pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-sm leading-5 text-slate-400 ${
                hasPlusMenu ? "inset-x-2" : "left-3.5 right-2"
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
        <div className="flex shrink-0 items-center gap-1.5">
          {hasSourcesMenu && (
            <div ref={sourcesMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={handleToggleSourcesMenu}
                disabled={disabled}
                className="chat-sources-trigger flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-slate-300 transition hover:text-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                aria-haspopup="dialog"
                aria-expanded={showSourcesMenu}
                aria-label={`Select chat sources (${sourcesButtonLabel} active)`}
                title="Choose which documents and sources to use as context"
              >
                <span>{sourcesButtonLabel}</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${showSourcesMenu ? "rotate-180" : ""}`}
                />
              </button>

              {showSourcesMenu && (
                <div
                  role="dialog"
                  aria-label="Select chat sources"
                  className={`chat-plus-menu absolute right-0 z-30 w-72 overflow-hidden rounded-2xl border border-white/10 shadow-[0_18px_40px_rgba(0,0,0,0.45)] sm:w-80 ${
                    sourcesMenuPlacement === "down" ? "top-full mt-2" : "bottom-full mb-2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-200">Sources</span>
                      <span className="text-[0.68rem] text-slate-400">
                        {selectedSourceCount}/{selectableSourceCount}
                      </span>
                    </div>
                    {selectableSourceCount > 0 && onSetAllSourcesSelected && (
                      <button
                        type="button"
                        onClick={() => onSetAllSourcesSelected(selectedSourceCount < selectableSourceCount)}
                        className="text-[0.7rem] font-medium text-cyan-300 transition hover:text-cyan-200"
                      >
                        {selectedSourceCount < selectableSourceCount ? "Select all" : "Clear all"}
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto p-1.5">
                    {sources.length === 0 ? (
                      <div className="px-2 py-3 text-center">
                        <p className="text-xs text-slate-400">No documents or sources available yet.</p>
                        {(onUploadFiles || onOpenUpload) && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsSourcesMenuOpen(false);
                              handleTriggerFileUpload();
                            }}
                            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:bg-white/10"
                          >
                            <Paperclip className="h-3 w-3" />
                            Upload files
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {sourceSections.map((section) => {
                          const selectableItems = section.items.filter(isSelectableSource);
                          const selectedInSection = selectableItems.filter((item) => selectedIdSet.has(item.id)).length;
                          const allSectionSelected =
                            selectableItems.length > 0 && selectedInSection === selectableItems.length;
                          const someSectionSelected =
                            selectedInSection > 0 && selectedInSection < selectableItems.length;
                          const isCollapsed = collapsedSections[section.key];

                          return (
                            <div key={section.key}>
                              <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/5">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSectionCollapse(section.key)}
                                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                  aria-expanded={!isCollapsed}
                                >
                                  <ChevronDown
                                    className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 ${
                                      isCollapsed ? "-rotate-90" : ""
                                    }`}
                                  />
                                  <span className="truncate text-[0.68rem] font-semibold uppercase tracking-wider text-slate-300">
                                    {section.label}
                                  </span>
                                  <span className="text-[0.65rem] text-slate-500">
                                    ({selectedInSection}/{selectableItems.length})
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  role="checkbox"
                                  aria-checked={allSectionSelected ? true : someSectionSelected ? "mixed" : false}
                                  aria-label={`Select all ${section.label}`}
                                  disabled={selectableItems.length === 0 || !onSetSectionSourcesSelected}
                                  onClick={() => onSetSectionSourcesSelected?.(section.key, !allSectionSelected)}
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                    allSectionSelected
                                      ? "border-cyan-400 bg-cyan-400 text-slate-950"
                                      : someSectionSelected
                                        ? "border-cyan-400/70 bg-cyan-400/20 text-cyan-200"
                                        : "border-slate-500/70 bg-transparent hover:border-slate-400"
                                  }`}
                                >
                                  {allSectionSelected ? (
                                    <Check className="h-3 w-3 stroke-[2.5]" />
                                  ) : someSectionSelected ? (
                                    <Minus className="h-3 w-3 stroke-[2.5]" />
                                  ) : null}
                                </button>
                              </div>

                              {!isCollapsed && (
                                <div className="mt-0.5 space-y-0.5 pl-2">
                                  {section.items.length === 0 ? (
                                    <p className="px-2 py-1 text-[0.7rem] text-slate-500">{section.emptyText}</p>
                                  ) : (
                                    section.items.map((source) => {
                                      const selectable = isSelectableSource(source);
                                      const checked = selectable && selectedIdSet.has(source.id);

                                      return (
                                        <button
                                          key={source.id}
                                          type="button"
                                          role="checkbox"
                                          aria-checked={checked}
                                          disabled={!selectable || !onToggleSourceSelection}
                                          onClick={() => onToggleSourceSelection?.(source.id)}
                                          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                            <span className="truncate text-slate-200" title={source.filename}>
                                              {source.filename}
                                            </span>
                                            {source.status === "indexing" && (
                                              <span className="shrink-0 text-[0.62rem] text-purple-300">
                                                Indexing
                                              </span>
                                            )}
                                            {source.status === "failed" && (
                                              <span className="shrink-0 text-[0.62rem] text-red-400">
                                                Failed
                                              </span>
                                            )}
                                          </div>
                                          <span
                                            className={`ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                                              checked
                                                ? "border-cyan-400 bg-cyan-400 text-slate-950"
                                                : "border-slate-500/70 bg-transparent"
                                            }`}
                                          >
                                            {checked && <Check className="h-3 w-3 stroke-[2.5]" />}
                                          </span>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

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
    </div>
  );
}
