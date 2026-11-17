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
  GraduationCap,
  Lightbulb,
  ListChecks,
  Minimize2,
  Minus,
  Paperclip,
  Plus,
  Scale,
  Send,
  Sparkles,
  Square,
  Terminal,
  X,
} from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  applyFileMentionSelection,
  applySlashCommandSelection,
  detectFileMentionQuery,
  detectSlashCommandQuery,
  resolveSubmissionCommands,
  syncMentionedSourcesWithText,
  type FileMentionMatch,
  type SlashCommandDefinition,
  type SlashCommandId,
  type SlashCommandMatch,
} from "../lib/chat-commands";
import { usePreferences } from "../lib/preferences";
import { type AutocompleteSuggestion, TrieAutocomplete } from "../lib/trie-autocomplete";
import { formatSourcesButtonLabel, isSelectableSource, type KnowledgeSource } from "../lib/ui-state";
import { ALLOWED_EXTENSIONS } from "../lib/upload-config";

const SLASH_COMMAND_ICONS: Record<SlashCommandId, React.ComponentType<{ className?: string }>> = {
  quiz: ListChecks,
  summarize: Sparkles,
  concepts: BookOpen,
  explain: Lightbulb,
  compare: Scale,
  exam: GraduationCap,
  compact: Minimize2,
};

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
  let offset = 0;

  return parts.map((part) => {
    const startOffset = offset;
    offset += part.length;
    if (tokens.some((t) => t.toLowerCase() === part.toLowerCase())) {
      return (
        <span key={`${startOffset}-${part}`} className="font-semibold text-cyan-200">
          {part}
        </span>
      );
    }
    return part;
  });
}

type SourceSectionSummary = {
  key: KnowledgeSource["sourceType"];
  label: string;
  items: KnowledgeSource[];
  emptyText: string;
};

function buildSourcesSummary(
  sources: KnowledgeSource[] | undefined,
  selectedSourceIds: string[] | undefined,
  includeKnowledgeBase: boolean,
) {
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

  const sourceSections: SourceSectionSummary[] = [
    {
      key: "uploaded",
      label: "Your Uploads",
      items: uploadedSources,
      emptyText: "No uploaded documents yet",
    },
    {
      key: "knowledge-base",
      label: "Knowledge Base",
      items: kbSources,
      emptyText: "No knowledge base documents",
    },
  ];

  return {
    selectableSourceCount: selectableAll.length,
    selectedSourceCount: selectedSelectable.length,
    selectedIdSet: selectedSet,
    sourceSections,
    sourcesButtonLabel: formatSourcesButtonLabel(selectedSelectable.length),
  };
}

function getActiveListLength(
  isSlashMenuOpen: boolean,
  slashMatchCount: number,
  isMentionMenuOpen: boolean,
  mentionMatchCount: number,
  autocompleteCount: number,
): number {
  if (isSlashMenuOpen) return slashMatchCount;
  if (isMentionMenuOpen) return mentionMatchCount;
  return autocompleteCount;
}

function resolveBoundedHighlightedIndex(
  highlightedIndex: number | null,
  activeListLength: number,
  isSlashMenuOpen: boolean,
  isMentionMenuOpen: boolean,
): number | null {
  if (highlightedIndex === null || activeListLength === 0) {
    if (isSlashMenuOpen || (isMentionMenuOpen && activeListLength > 0)) {
      return 0;
    }
    return null;
  }
  return Math.min(highlightedIndex, activeListLength - 1);
}

function buildQuizRawPrompt(rawValue: string): string {
  const trimmed = rawValue.trim();
  if (!trimmed) return "/quiz";
  return trimmed.startsWith("/quiz") ? trimmed : `/quiz ${trimmed}`;
}

function getInputPlaceholder(
  focusedDocumentName: string | null,
  isTemporaryChat: boolean,
  includeKnowledgeBase: boolean,
): string {
  if (focusedDocumentName) {
    return `Ask about ${focusedDocumentName}... (Type / or @)`;
  }
  if (isTemporaryChat) {
    return "Ask in a temporary chat... (Type / for commands, @ for files)";
  }
  if (includeKnowledgeBase) {
    return "Ask IntelliSeek... (Type / for commands, @ for files)";
  }
  return "Ask only from your uploaded documents... (Type / or @)";
}

function computeMenuPlacement(element: HTMLElement | null, minSpaceBelow: number): "down" | "up" {
  const rect = element?.getBoundingClientRect();
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  return spaceBelow >= minSpaceBelow ? "down" : "up";
}

function isEditableElement(target: HTMLElement | null): boolean {
  if (!target) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

const KEY_UP_NAV_IGNORED = new Set(["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"]);

type TextareaKeyDownParams = {
  event: React.KeyboardEvent<HTMLTextAreaElement>;
  value: string;
  sendOnEnter: boolean;
  anyComposerMenuOpen: boolean;
  isSlashMenuOpen: boolean;
  isMentionMenuOpen: boolean;
  isAutocompleteOpen: boolean;
  slashMatches: SlashCommandDefinition[];
  mentionMatches: KnowledgeSource[];
  autocompleteMatches: AutocompleteSuggestion[];
  activeListLength: number;
  boundedHighlightedIndex: number | null;
  onDismissMenu: () => void;
  onChangeHighlightedIndex: (updater: (current: number | null) => number | null) => void;
  onSelectSlashCommand: (command: SlashCommandDefinition) => void;
  onSelectFileMention: (source: KnowledgeSource) => void;
  onSelectSuggestion: (suggestion: AutocompleteSuggestion) => void;
  onSubmit: () => void;
};

function handleArrowNavigation(
  key: string,
  hasInitialZero: boolean,
  activeListLength: number,
  onChangeHighlightedIndex: (updater: (current: number | null) => number | null) => void,
) {
  if (key === "ArrowDown") {
    onChangeHighlightedIndex((current) => {
      const base = current ?? (hasInitialZero ? 0 : -1);
      return (base + 1) % activeListLength;
    });
    return;
  }

  onChangeHighlightedIndex((current) =>
    current === null || current === 0 ? activeListLength - 1 : current - 1,
  );
}

function tryConfirmSlashOrMention(
  params: TextareaKeyDownParams,
  allowExactNoArgSubmit: boolean,
): boolean {
  const {
    isSlashMenuOpen,
    isMentionMenuOpen,
    slashMatches,
    mentionMatches,
    boundedHighlightedIndex,
    value,
    event,
    onSelectSlashCommand,
    onSelectFileMention,
  } = params;

  if (boundedHighlightedIndex === null) return false;

  if (isSlashMenuOpen) {
    const cmd = slashMatches[boundedHighlightedIndex];
    const isExactNoArgMatch =
      allowExactNoArgSubmit &&
      Boolean(cmd) &&
      !cmd.requiresArgs &&
      cmd.command.toLowerCase() === value.trim().toLowerCase();
    if (cmd && !isExactNoArgMatch) {
      event.preventDefault();
      onSelectSlashCommand(cmd);
      return true;
    }
  }

  if (isMentionMenuOpen) {
    const source = mentionMatches[boundedHighlightedIndex];
    if (source) {
      event.preventDefault();
      onSelectFileMention(source);
      return true;
    }
  }

  return false;
}

function tryConfirmAutocompleteSelection(params: TextareaKeyDownParams): boolean {
  const {
    event,
    isAutocompleteOpen,
    boundedHighlightedIndex,
    autocompleteMatches,
    onSelectSuggestion,
  } = params;
  if (event.shiftKey || !isAutocompleteOpen || boundedHighlightedIndex === null) {
    return false;
  }
  const match = autocompleteMatches[boundedHighlightedIndex];
  if (!match) return false;
  event.preventDefault();
  onSelectSuggestion(match);
  return true;
}

function tryHandleMenuNavigationKey(params: TextareaKeyDownParams): boolean {
  const {
    event,
    anyComposerMenuOpen,
    isSlashMenuOpen,
    isMentionMenuOpen,
    activeListLength,
    onDismissMenu,
    onChangeHighlightedIndex,
  } = params;

  if (event.key === "Escape" && anyComposerMenuOpen) {
    event.preventDefault();
    onDismissMenu();
    return true;
  }

  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && anyComposerMenuOpen && activeListLength > 0) {
    event.preventDefault();
    handleArrowNavigation(event.key, isSlashMenuOpen || isMentionMenuOpen, activeListLength, onChangeHighlightedIndex);
    return true;
  }

  if (event.key === "Tab" && !event.shiftKey) {
    tryConfirmSlashOrMention(params, false);
    return true;
  }

  return false;
}

function processTextareaKeyDown(params: TextareaKeyDownParams): void {
  if (tryHandleMenuNavigationKey(params)) return;

  const { event, sendOnEnter, onSubmit } = params;
  if (event.key !== "Enter") return;

  const shouldSend = sendOnEnter ? !event.shiftKey : event.ctrlKey || event.metaKey;
  if (!event.shiftKey && tryConfirmSlashOrMention(params, shouldSend)) {
    return;
  }

  if (tryConfirmAutocompleteSelection(params)) {
    return;
  }

  if (shouldSend) {
    event.preventDefault();
    onSubmit();
  }
}

function SlashCommandPopover({
  matches,
  boundedHighlightedIndex,
  onSelect,
}: Readonly<{
  matches: SlashCommandDefinition[];
  boundedHighlightedIndex: number | null;
  onSelect: (command: SlashCommandDefinition) => void;
}>) {
  return (
    <section
      aria-label="Slash commands"
      className="chat-command-menu absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
        <span className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5" />
          Slash commands
        </span>
        <span className="text-[0.65rem] tracking-normal text-slate-500 normal-case">
          ↑↓ to navigate • Enter/Tab to select • Esc to dismiss
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        {matches.map((command, index) => {
          const Icon = SLASH_COMMAND_ICONS[command.id];
          const isHighlighted = boundedHighlightedIndex === index;
          const rowClass = isHighlighted
            ? "bg-cyan-300/15 text-cyan-50"
            : "text-slate-300 hover:bg-white/5 hover:text-white";
          return (
            <button
              key={command.id}
              type="button"
              aria-current={isHighlighted ? "true" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(command)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${rowClass}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-cyan-300" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-cyan-200">{command.command}</span>
                    <span className="text-xs font-medium text-slate-200">{command.label}</span>
                  </div>
                  <p className="truncate text-[0.7rem] text-slate-400">{command.description}</p>
                </div>
              </div>
              <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[0.62rem] text-slate-400 sm:inline-block">
                {command.usageHint}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

const EMPTY_MENTION_NO_MATCH_MESSAGE = "No matching files found.";
const EMPTY_MENTION_NO_SOURCES_MESSAGE = "No uploaded or knowledge-base files yet.";

function FileMentionRow({
  source,
  isHighlighted,
  onSelect,
}: Readonly<{
  source: KnowledgeSource;
  isHighlighted: boolean;
  onSelect: (source: KnowledgeSource) => void;
}>) {
  const isKb = source.sourceType === "knowledge-base";
  const rowClass = isHighlighted ? "bg-cyan-300/15 text-cyan-50" : "text-slate-300 hover:bg-white/5 hover:text-white";
  const badgeClass = isKb
    ? "border-violet-400/30 bg-violet-400/10 text-violet-200"
    : "border-cyan-400/30 bg-cyan-400/10 text-cyan-200";
  const badgeLabel = isKb ? "Knowledge Base" : "Your Upload";

  return (
    <button
      type="button"
      aria-current={isHighlighted ? "true" : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(source)}
      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${rowClass}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
        <span className="truncate font-medium">{source.filename}</span>
        {source.status === "indexing" && (
          <span className="shrink-0 text-[0.62rem] text-purple-300">Indexing</span>
        )}
      </div>
      <span
        className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-[0.14em] ${badgeClass}`}
      >
        {badgeLabel}
      </span>
    </button>
  );
}

function FileMentionListBody({
  matches,
  hasAnySources,
  boundedHighlightedIndex,
  onSelect,
}: Readonly<{
  matches: KnowledgeSource[];
  hasAnySources: boolean;
  boundedHighlightedIndex: number | null;
  onSelect: (source: KnowledgeSource) => void;
}>) {
  if (matches.length === 0) {
    return (
      <p className="px-3 py-3 text-center text-xs text-slate-400">
        {hasAnySources ? EMPTY_MENTION_NO_MATCH_MESSAGE : EMPTY_MENTION_NO_SOURCES_MESSAGE}
      </p>
    );
  }
  return (
    <>
      {matches.map((source, index) => (
        <FileMentionRow
          key={source.id}
          source={source}
          isHighlighted={boundedHighlightedIndex === index}
          onSelect={onSelect}
        />
      ))}
    </>
  );
}

function FileMentionPopover({
  matches,
  hasAnySources,
  boundedHighlightedIndex,
  onSelect,
}: Readonly<{
  matches: KnowledgeSource[];
  hasAnySources: boolean;
  boundedHighlightedIndex: number | null;
  onSelect: (source: KnowledgeSource) => void;
}>) {
  return (
    <section
      aria-label="Mention files for context"
      className="chat-command-menu absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.22em] text-cyan-200">
        <span className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5" />
          Files &amp; Sources
        </span>
        <span className="text-[0.65rem] tracking-normal text-slate-500 normal-case">
          ↑↓ to navigate • Enter/Tab to attach • Esc to dismiss
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto p-1">
        <FileMentionListBody
          matches={matches}
          hasAnySources={hasAnySources}
          boundedHighlightedIndex={boundedHighlightedIndex}
          onSelect={onSelect}
        />
      </div>
    </section>
  );
}

function TrieAutocompletePopover({
  matches,
  value,
  boundedHighlightedIndex,
  onSelect,
}: Readonly<{
  matches: AutocompleteSuggestion[];
  value: string;
  boundedHighlightedIndex: number | null;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
}>) {
  return (
    <section
      aria-label="Autocomplete suggestions"
      className="chat-command-menu absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-cyan-300/20 bg-slate-950/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl"
    >
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
          const rowClass =
            boundedHighlightedIndex === index
              ? "bg-cyan-300/15 text-cyan-50"
              : "text-slate-300 hover:bg-white/5 hover:text-white";
          return (
            <button
              key={match.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onSelect(match)}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${rowClass}`}
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
    </section>
  );
}

function ChatInputActivePopover({
  isSlashMenuOpen,
  isMentionMenuOpen,
  isAutocompleteOpen,
  slashMatches,
  mentionMatches,
  autocompleteMatches,
  hasAnySources,
  value,
  boundedHighlightedIndex,
  onSelectSlashCommand,
  onSelectFileMention,
  onSelectSuggestion,
}: Readonly<{
  isSlashMenuOpen: boolean;
  isMentionMenuOpen: boolean;
  isAutocompleteOpen: boolean;
  slashMatches: SlashCommandDefinition[];
  mentionMatches: KnowledgeSource[];
  autocompleteMatches: AutocompleteSuggestion[];
  hasAnySources: boolean;
  value: string;
  boundedHighlightedIndex: number | null;
  onSelectSlashCommand: (command: SlashCommandDefinition) => void;
  onSelectFileMention: (source: KnowledgeSource) => void;
  onSelectSuggestion: (suggestion: AutocompleteSuggestion) => void;
}>) {
  if (isSlashMenuOpen) {
    return (
      <SlashCommandPopover
        matches={slashMatches}
        boundedHighlightedIndex={boundedHighlightedIndex}
        onSelect={onSelectSlashCommand}
      />
    );
  }
  if (isMentionMenuOpen) {
    return (
      <FileMentionPopover
        matches={mentionMatches}
        hasAnySources={hasAnySources}
        boundedHighlightedIndex={boundedHighlightedIndex}
        onSelect={onSelectFileMention}
      />
    );
  }
  if (isAutocompleteOpen && autocompleteMatches.length > 0) {
    return (
      <TrieAutocompletePopover
        matches={autocompleteMatches}
        value={value}
        boundedHighlightedIndex={boundedHighlightedIndex}
        onSelect={onSelectSuggestion}
      />
    );
  }
  return null;
}

function MentionedSourcesBar({
  mentionedSources,
  onRemove,
}: Readonly<{
  mentionedSources: KnowledgeSource[];
  onRemove: (sourceId: string) => void;
}>) {
  if (mentionedSources.length === 0) return null;

  return (
    <div className="mb-1 flex flex-wrap items-center gap-1.5 px-2 pt-1">
      {mentionedSources.map((source) => (
        <span
          key={source.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-400/12 px-2.5 py-0.5 text-xs font-medium text-cyan-100"
        >
          <FileText className="h-3 w-3 shrink-0 text-cyan-300" />
          <span className="max-w-44 truncate">@{source.filename}</span>
          <button
            type="button"
            onClick={() => onRemove(source.id)}
            className="rounded-full p-0.5 text-cyan-200/75 transition hover:bg-white/10 hover:text-white"
            aria-label={`Remove ${source.filename} mention`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

function PlusToolsMenu({
  placement,
  canUpload,
  includeKnowledgeBase,
  knowledgeBaseCount,
  onTriggerUpload,
  onQuickPracticeQuiz,
  onClose,
  onToggleKnowledgeBase,
}: Readonly<{
  placement: "down" | "up";
  canUpload: boolean;
  includeKnowledgeBase: boolean;
  knowledgeBaseCount?: number;
  onTriggerUpload: () => void;
  onQuickPracticeQuiz: () => void;
  onClose: () => void;
  onToggleKnowledgeBase?: () => void;
}>) {
  const placementClass =
    placement === "down" ? "top-full mt-3 origin-top-left" : "bottom-full mb-3 origin-bottom-left";
  const kbIconClass = includeKnowledgeBase ? "text-cyan-300" : "text-amber-300";
  const kbBadgeClass = includeKnowledgeBase
    ? "bg-cyan-300/15 text-cyan-200"
    : "bg-white/10 text-slate-400";
  const switchTrackClass = includeKnowledgeBase
    ? "border-cyan-400/50 bg-cyan-500"
    : "border-slate-500/30 bg-slate-600/40";
  const switchThumbClass = includeKnowledgeBase ? "translate-x-4" : "translate-x-0.5";

  return (
    <div
      role="menu"
      aria-label="Chat attachments and context tools"
      className={`chat-plus-menu absolute -left-1.5 z-30 w-64 rounded-2xl border border-white/10 p-1.5 shadow-[0_18px_42px_rgba(0,0,0,0.48)] ${placementClass}`}
    >
      {canUpload && (
        <button
          type="button"
          role="menuitem"
          onClick={onTriggerUpload}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-slate-100 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-300"
        >
          <Paperclip className="h-4 w-4 shrink-0 text-slate-300" />
          <div className="min-w-0 flex-1">
            <div className="font-medium leading-tight">Upload files</div>
            <div className="mt-0.5 text-[0.7rem] text-slate-400">PDF, DOCX, PPTX, TXT, MD</div>
          </div>
        </button>
      )}

      <button
        type="button"
        role="menuitem"
        onClick={onQuickPracticeQuiz}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-300"
      >
        <ListChecks className="h-4 w-4 shrink-0 text-cyan-300" />
        <div className="min-w-0 flex-1">
          <div className="font-medium leading-tight">Practice quiz</div>
          <div className="mt-0.5 text-[0.7rem] text-slate-400">Interactive quiz from sources</div>
        </div>
      </button>

      <Link
        href="/library"
        role="menuitem"
        onClick={onClose}
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
              <Database className={`h-4 w-4 shrink-0 transition-colors ${kbIconClass}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-slate-100">
                  <span>Knowledge Base</span>
                  {typeof knowledgeBaseCount === "number" && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none ${kbBadgeClass}`}>
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
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 ${switchTrackClass}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${switchThumbClass}`}
              />
            </span>
          </button>
        </>
      )}
    </div>
  );
}

function SectionSelectCheckbox({
  label,
  allSelected,
  someSelected,
  disabled,
  onToggle,
}: Readonly<{
  label: string;
  allSelected: boolean;
  someSelected: boolean;
  disabled: boolean;
  onToggle: () => void;
}>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = !allSelected && someSelected;
    }
  }, [allSelected, someSelected]);

  let boxClass = "border-slate-500/70 bg-transparent hover:border-slate-400";
  if (allSelected) {
    boxClass = "border-cyan-400 bg-cyan-400 text-slate-950";
  } else if (someSelected) {
    boxClass = "border-cyan-400/70 bg-cyan-400/20 text-cyan-200";
  }

  return (
    <label
      className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded border transition focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-cyan-300 ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"
      } ${boxClass}`}
    >
      <input
        ref={inputRef}
        type="checkbox"
        checked={allSelected}
        disabled={disabled}
        onChange={onToggle}
        aria-label={`Select all ${label}`}
        className="sr-only"
      />
      {allSelected && <Check className="h-3 w-3 stroke-[2.5]" />}
      {!allSelected && someSelected && <Minus className="h-3 w-3 stroke-[2.5]" />}
    </label>
  );
}

function SourceCheckboxItem({
  source,
  checked,
  disabled,
  onToggle,
}: Readonly<{
  source: KnowledgeSource;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}>) {
  const checkBoxClass = checked
    ? "border-cyan-400 bg-cyan-400 text-slate-950"
    : "border-slate-500/70 bg-transparent";

  return (
    <label
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left text-xs transition hover:bg-white/5 focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-cyan-300 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onToggle}
        className="sr-only"
      />
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span className="truncate text-slate-200" title={source.filename}>
          {source.filename}
        </span>
        {source.status === "indexing" && (
          <span className="shrink-0 text-[0.62rem] text-purple-300">Indexing</span>
        )}
        {source.status === "failed" && (
          <span className="shrink-0 text-[0.62rem] text-red-400">Failed</span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${checkBoxClass}`}
      >
        {checked && <Check className="h-3 w-3 stroke-[2.5]" />}
      </span>
    </label>
  );
}

function SourcesSectionGroup({
  section,
  isCollapsed,
  selectedIdSet,
  canToggleSection,
  canToggleSource,
  onToggleCollapse,
  onSetSectionSelected,
  onToggleSourceSelection,
}: Readonly<{
  section: SourceSectionSummary;
  isCollapsed: boolean;
  selectedIdSet: Set<string>;
  canToggleSection: boolean;
  canToggleSource: boolean;
  onToggleCollapse: () => void;
  onSetSectionSelected?: (selected: boolean) => void;
  onToggleSourceSelection?: (sourceId: string) => void;
}>) {
  const selectableItems = section.items.filter(isSelectableSource);
  const selectedInSection = selectableItems.filter((item) => selectedIdSet.has(item.id)).length;
  const allSectionSelected = selectableItems.length > 0 && selectedInSection === selectableItems.length;
  const someSectionSelected = selectedInSection > 0 && selectedInSection < selectableItems.length;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-white/5">
        <button
          type="button"
          onClick={onToggleCollapse}
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
        <SectionSelectCheckbox
          label={section.label}
          allSelected={allSectionSelected}
          someSelected={someSectionSelected}
          disabled={selectableItems.length === 0 || !canToggleSection}
          onToggle={() => onSetSectionSelected?.(!allSectionSelected)}
        />
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
                <SourceCheckboxItem
                  key={source.id}
                  source={source}
                  checked={checked}
                  disabled={!selectable || !canToggleSource}
                  onToggle={() => onToggleSourceSelection?.(source.id)}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function SourcesSelectorPopover({
  placement,
  sources,
  sourceSections,
  selectedIdSet,
  selectableSourceCount,
  selectedSourceCount,
  collapsedSections,
  canUpload,
  onTriggerUploadFromSources,
  onSetAllSourcesSelected,
  onToggleSectionCollapse,
  onSetSectionSourcesSelected,
  onToggleSourceSelection,
}: Readonly<{
  placement: "down" | "up";
  sources: KnowledgeSource[];
  sourceSections: SourceSectionSummary[];
  selectedIdSet: Set<string>;
  selectableSourceCount: number;
  selectedSourceCount: number;
  collapsedSections: Record<KnowledgeSource["sourceType"], boolean>;
  canUpload: boolean;
  onTriggerUploadFromSources: () => void;
  onSetAllSourcesSelected?: (selected: boolean) => void;
  onToggleSectionCollapse: (sectionKey: KnowledgeSource["sourceType"]) => void;
  onSetSectionSourcesSelected?: (sourceType: KnowledgeSource["sourceType"], selected: boolean) => void;
  onToggleSourceSelection?: (sourceId: string) => void;
}>) {
  const placementClass = placement === "down" ? "top-full mt-2" : "bottom-full mb-2";

  return (
    <dialog
      open
      aria-label="Select chat sources"
      className={`chat-plus-menu absolute left-auto right-0 z-30 m-0 w-72 overflow-hidden rounded-2xl border border-white/10 p-0 text-inherit shadow-[0_18px_40px_rgba(0,0,0,0.45)] sm:w-80 ${placementClass}`}
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
            {canUpload && (
              <button
                type="button"
                onClick={onTriggerUploadFromSources}
                className="mt-2 inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-cyan-300 transition hover:bg-white/10"
              >
                <Paperclip className="h-3 w-3" />
                Upload files
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {sourceSections.map((section) => (
              <SourcesSectionGroup
                key={section.key}
                section={section}
                isCollapsed={collapsedSections[section.key]}
                selectedIdSet={selectedIdSet}
                canToggleSection={Boolean(onSetSectionSourcesSelected)}
                canToggleSource={Boolean(onToggleSourceSelection)}
                onToggleCollapse={() => onToggleSectionCollapse(section.key)}
                onSetSectionSelected={(selected) => onSetSectionSourcesSelected?.(section.key, selected)}
                onToggleSourceSelection={onToggleSourceSelection}
              />
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}

type ChatInputProps = {
  autocompleteSuggestions?: AutocompleteSuggestion[];
  disabled?: boolean;
  isResponding?: boolean;
  focusedDocumentName?: string | null;
  includeKnowledgeBase?: boolean;
  knowledgeBaseCount?: number;
  isTemporaryChat?: boolean;
  hasPriorMessages?: boolean;
  sources?: KnowledgeSource[];
  selectedSourceIds?: string[];
  onToggleKnowledgeBase?: () => void;
  onToggleSourceSelection?: (sourceId: string) => void;
  onSetSectionSourcesSelected?: (sourceType: KnowledgeSource["sourceType"], selected: boolean) => void;
  onSetAllSourcesSelected?: (selected: boolean) => void;
  onSubmit: (
    question: string,
    selectedSuggestion?: AutocompleteSuggestion,
    scopedDocumentIds?: string[],
  ) => boolean;
  onStopResponse?: () => void;
  onOpenUpload?: () => void;
  onUploadFiles?: (files: File[]) => void;
};

function computeSlashMatch(
  disabled: boolean,
  isAutocompleteDismissed: boolean,
  value: string,
  cursorPosition: number,
): SlashCommandMatch | null {
  if (disabled || isAutocompleteDismissed) return null;
  return detectSlashCommandQuery(value, cursorPosition);
}

function computeMentionMatch(
  disabled: boolean,
  isAutocompleteDismissed: boolean,
  slashMatch: SlashCommandMatch | null,
  sources: KnowledgeSource[] | undefined,
  value: string,
  cursorPosition: number,
): FileMentionMatch | null {
  if (disabled || isAutocompleteDismissed || slashMatch || sources === undefined) return null;
  return detectFileMentionQuery(value, cursorPosition, sources);
}

function computeAutocompleteMatches(
  value: string,
  disabled: boolean,
  isSlashMenuOpen: boolean,
  isMentionMenuOpen: boolean,
  trie: TrieAutocomplete,
): AutocompleteSuggestion[] {
  const query = value.trim();
  if (query.length < 2 || disabled || isSlashMenuOpen || isMentionMenuOpen || query.startsWith("/")) {
    return [];
  }
  return trie.search(query, 6);
}

function useMenuDismissListeners(
  isPlusMenuOpen: boolean,
  isSourcesMenuOpen: boolean,
  plusMenuRef: React.RefObject<HTMLDivElement | null>,
  sourcesMenuRef: React.RefObject<HTMLDivElement | null>,
  onCloseAll: () => void,
  onClosePlus: () => void,
  onCloseSources: () => void,
) {
  useEffect(() => {
    if (!isPlusMenuOpen && !isSourcesMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (isPlusMenuOpen && !plusMenuRef.current?.contains(target)) {
        onClosePlus();
      }
      if (isSourcesMenuOpen && !sourcesMenuRef.current?.contains(target)) {
        onCloseSources();
      }
    };

    const handleMenuEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseAll();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleMenuEscape);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleMenuEscape);
    };
  }, [isPlusMenuOpen, isSourcesMenuOpen, onCloseAll, onClosePlus, onCloseSources, plusMenuRef, sourcesMenuRef]);
}

function useSlashFocusShortcut(
  disabled: boolean,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
) {
  useEffect(() => {
    const handleGlobalKeyDown = (event: globalThis.KeyboardEvent) => {
      if (disabled || event.defaultPrevented || isEditableElement(event.target as HTMLElement | null)) {
        return;
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [disabled, textareaRef]);
}

function PlusMenuControl({
  hasPlusMenu,
  plusMenuRef,
  fileInputRef,
  disabled,
  showPlusMenu,
  plusMenuPlacement,
  canUploadFiles,
  includeKnowledgeBase,
  knowledgeBaseCount,
  onUploadFiles,
  onFileSelection,
  onTogglePlusMenu,
  onTriggerUpload,
  onQuickPracticeQuiz,
  onCloseMenu,
  onToggleKnowledgeBase,
}: Readonly<{
  hasPlusMenu: boolean;
  plusMenuRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  disabled: boolean;
  showPlusMenu: boolean;
  plusMenuPlacement: "down" | "up";
  canUploadFiles: boolean;
  includeKnowledgeBase: boolean;
  knowledgeBaseCount?: number;
  onUploadFiles?: (files: File[]) => void;
  onFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onTogglePlusMenu: () => void;
  onTriggerUpload: () => void;
  onQuickPracticeQuiz: () => void;
  onCloseMenu: () => void;
  onToggleKnowledgeBase?: () => void;
}>) {
  if (!hasPlusMenu) return null;

  const triggerClass = showPlusMenu
    ? "bg-white/10 text-slate-100"
    : "bg-transparent text-slate-300 hover:bg-white/10 hover:text-slate-100";

  return (
    <div ref={plusMenuRef} className="relative shrink-0">
      {onUploadFiles && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(",")}
          onChange={onFileSelection}
          disabled={disabled}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
      <button
        type="button"
        onClick={onTogglePlusMenu}
        disabled={disabled}
        aria-expanded={showPlusMenu}
        aria-haspopup="menu"
        aria-label={showPlusMenu ? "Close tools menu" : "Add files and tools"}
        title={showPlusMenu ? "Close menu" : "Add files & tools"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 ${triggerClass}`}
      >
        <Plus
          className={`h-5 w-5 transition-transform duration-200 ${showPlusMenu ? "rotate-45" : ""}`}
          strokeWidth={2.25}
        />
      </button>

      {showPlusMenu && (
        <PlusToolsMenu
          placement={plusMenuPlacement}
          canUpload={canUploadFiles}
          includeKnowledgeBase={includeKnowledgeBase}
          knowledgeBaseCount={knowledgeBaseCount}
          onTriggerUpload={onTriggerUpload}
          onQuickPracticeQuiz={onQuickPracticeQuiz}
          onClose={onCloseMenu}
          onToggleKnowledgeBase={onToggleKnowledgeBase}
        />
      )}
    </div>
  );
}

function SourcesMenuControl({
  hasSourcesMenu,
  sourcesMenuRef,
  disabled,
  showSourcesMenu,
  sourcesMenuPlacement,
  sourcesButtonLabel,
  sources,
  sourceSections,
  selectedIdSet,
  selectableSourceCount,
  selectedSourceCount,
  collapsedSections,
  canUploadFiles,
  onToggleSourcesMenu,
  onTriggerUploadFromSources,
  onSetAllSourcesSelected,
  onToggleSectionCollapse,
  onSetSectionSourcesSelected,
  onToggleSourceSelection,
}: Readonly<{
  hasSourcesMenu: boolean;
  sourcesMenuRef: React.RefObject<HTMLDivElement | null>;
  disabled: boolean;
  showSourcesMenu: boolean;
  sourcesMenuPlacement: "down" | "up";
  sourcesButtonLabel: string;
  sources: KnowledgeSource[] | undefined;
  sourceSections: SourceSectionSummary[];
  selectedIdSet: Set<string>;
  selectableSourceCount: number;
  selectedSourceCount: number;
  collapsedSections: Record<KnowledgeSource["sourceType"], boolean>;
  canUploadFiles: boolean;
  onToggleSourcesMenu: () => void;
  onTriggerUploadFromSources: () => void;
  onSetAllSourcesSelected?: (selected: boolean) => void;
  onToggleSectionCollapse: (sectionKey: KnowledgeSource["sourceType"]) => void;
  onSetSectionSourcesSelected?: (sourceType: KnowledgeSource["sourceType"], selected: boolean) => void;
  onToggleSourceSelection?: (sourceId: string) => void;
}>) {
  if (!hasSourcesMenu || sources === undefined) return null;

  return (
    <div ref={sourcesMenuRef} className="relative shrink-0">
      <button
        type="button"
        onClick={onToggleSourcesMenu}
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
        <SourcesSelectorPopover
          placement={sourcesMenuPlacement}
          sources={sources}
          sourceSections={sourceSections}
          selectedIdSet={selectedIdSet}
          selectableSourceCount={selectableSourceCount}
          selectedSourceCount={selectedSourceCount}
          collapsedSections={collapsedSections}
          canUpload={canUploadFiles}
          onTriggerUploadFromSources={onTriggerUploadFromSources}
          onSetAllSourcesSelected={onSetAllSourcesSelected}
          onToggleSectionCollapse={onToggleSectionCollapse}
          onSetSectionSourcesSelected={onSetSectionSourcesSelected}
          onToggleSourceSelection={onToggleSourceSelection}
        />
      )}
    </div>
  );
}

function SubmitOrStopButton({
  disabled,
  isResponding,
  hasValue,
  onStopResponse,
  onSubmit,
}: Readonly<{
  disabled: boolean;
  isResponding: boolean;
  hasValue: boolean;
  onStopResponse?: () => void;
  onSubmit: () => void;
}>) {
  const actionLabel = isResponding ? "Stop response" : "Send question";
  const isDisabled = disabled || (!isResponding && !hasValue);

  return (
    <button
      type="button"
      onClick={() => (isResponding ? onStopResponse?.() : onSubmit())}
      disabled={isDisabled}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
      aria-label={actionLabel}
      title={actionLabel}
    >
      {isResponding ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-4 w-4" />}
    </button>
  );
}

function resizeTextareaToContent(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
}

function focusAndSetTextareaCaret(textareaRef: React.RefObject<HTMLTextAreaElement | null>, caret: number) {
  window.requestAnimationFrame(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.focus();
    textarea.setSelectionRange(caret, caret);
  });
}

function stripRemovedSourceMention(value: string, target: KnowledgeSource | undefined): string {
  if (!target) return value;
  const escaped = target.filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value
    .replace(new RegExp(`@${escaped}\\s*`, "gi"), "")
    .replace(/[ \t]{2,}/g, " ");
}

function buildSubmissionArgs(params: {
  raw: string;
  sources?: KnowledgeSource[];
  mentionedSources: KnowledgeSource[];
  hasPriorMessages: boolean;
  selectedSuggestion?: AutocompleteSuggestion;
}) {
  const resolved = resolveSubmissionCommands(
    params.raw,
    params.sources ?? [],
    params.mentionedSources,
    params.hasPriorMessages,
  );
  const suggestionArg =
    !resolved.slashCommand && params.selectedSuggestion?.value.trim() === params.raw
      ? params.selectedSuggestion
      : undefined;
  const scopedDocArg = resolved.mentionedDocumentIds.length ? resolved.mentionedDocumentIds : undefined;
  return {
    promptToSend: resolved.promptToSend,
    suggestionArg,
    scopedDocArg,
  };
}

function resolveComposerListLengths(params: {
  slashMatchesCount: number;
  hasMentionMatch: boolean;
  mentionMatchesCount: number;
  autocompleteMatchesCount: number;
  isAutocompleteDismissed: boolean;
  highlightedIndex: number | null;
  hasPlusMenu: boolean;
  isPlusMenuOpen: boolean;
  hasSourcesMenu: boolean;
  isSourcesMenuOpen: boolean;
  disabled: boolean;
}) {
  const isSlashMenuOpen = params.slashMatchesCount > 0;
  const isMentionMenuOpen = params.hasMentionMatch;
  const activeListLength = getActiveListLength(
    isSlashMenuOpen,
    params.slashMatchesCount,
    isMentionMenuOpen,
    params.mentionMatchesCount,
    params.autocompleteMatchesCount,
  );
  const boundedHighlightedIndex = resolveBoundedHighlightedIndex(
    params.highlightedIndex,
    activeListLength,
    isSlashMenuOpen,
    isMentionMenuOpen,
  );
  const isAutocompleteOpen =
    !isSlashMenuOpen && !isMentionMenuOpen && !params.isAutocompleteDismissed && params.autocompleteMatchesCount > 0;
  const anyComposerMenuOpen = isSlashMenuOpen || isMentionMenuOpen || isAutocompleteOpen;
  return {
    isSlashMenuOpen,
    isMentionMenuOpen,
    activeListLength,
    boundedHighlightedIndex,
    isAutocompleteOpen,
    anyComposerMenuOpen,
    showPlusMenu: params.hasPlusMenu && params.isPlusMenuOpen && !params.disabled && !anyComposerMenuOpen,
    showSourcesMenu: params.hasSourcesMenu && params.isSourcesMenuOpen && !params.disabled && !anyComposerMenuOpen,
  };
}

function useChatInputPopovers(params: {
  disabled: boolean;
  onUploadFiles?: (files: File[]) => void;
  onOpenUpload?: () => void;
}) {
  const { disabled, onUploadFiles, onOpenUpload } = params;
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [plusMenuPlacement, setPlusMenuPlacement] = useState<"down" | "up">("down");
  const [isSourcesMenuOpen, setIsSourcesMenuOpen] = useState(false);
  const [sourcesMenuPlacement, setSourcesMenuPlacement] = useState<"down" | "up">("down");
  const [collapsedSections, setCollapsedSections] = useState<Record<KnowledgeSource["sourceType"], boolean>>({
    uploaded: false,
    "knowledge-base": false,
  });
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const sourcesMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useMenuDismissListeners(
    isPlusMenuOpen,
    isSourcesMenuOpen,
    plusMenuRef,
    sourcesMenuRef,
    () => {
      setIsPlusMenuOpen(false);
      setIsSourcesMenuOpen(false);
    },
    () => setIsPlusMenuOpen(false),
    () => setIsSourcesMenuOpen(false),
  );

  const handleTogglePlusMenu = () => {
    if (disabled) return;
    setIsSourcesMenuOpen(false);
    if (isPlusMenuOpen) {
      setIsPlusMenuOpen(false);
      return;
    }
    setPlusMenuPlacement(computeMenuPlacement(plusMenuRef.current, 285));
    setIsPlusMenuOpen(true);
  };

  const handleToggleSourcesMenu = () => {
    if (disabled) return;
    setIsPlusMenuOpen(false);
    if (isSourcesMenuOpen) {
      setIsSourcesMenuOpen(false);
      return;
    }
    setSourcesMenuPlacement(computeMenuPlacement(sourcesMenuRef.current, 280));
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

  return {
    isPlusMenuOpen,
    setIsPlusMenuOpen,
    plusMenuPlacement,
    isSourcesMenuOpen,
    setIsSourcesMenuOpen,
    sourcesMenuPlacement,
    collapsedSections,
    plusMenuRef,
    sourcesMenuRef,
    fileInputRef,
    handleTogglePlusMenu,
    handleToggleSourcesMenu,
    handleToggleSectionCollapse,
    handleTriggerFileUpload,
    handleFileSelection,
  };
}

function appendMentionedSourceIfNew(current: KnowledgeSource[], source: KnowledgeSource): KnowledgeSource[] {
  if (current.some((item) => item.id === source.id)) {
    return current;
  }
  return [...current, source];
}

function useChatInputDraft(params: {
  disabled: boolean;
  sources?: KnowledgeSource[];
  hasPriorMessages: boolean;
  onSubmit: ChatInputProps["onSubmit"];
}) {
  const { disabled, sources, hasPriorMessages, onSubmit } = params;
  const [value, setValue] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionedSources, setMentionedSources] = useState<KnowledgeSource[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AutocompleteSuggestion | undefined>();
  const [isAutocompleteDismissed, setIsAutocompleteDismissed] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    resizeTextareaToContent(textareaRef.current);
  }, [value]);

  useSlashFocusShortcut(disabled, textareaRef);

  const slashMatch = useMemo(
    () => computeSlashMatch(disabled, isAutocompleteDismissed, value, cursorPosition),
    [cursorPosition, disabled, isAutocompleteDismissed, value],
  );

  const mentionMatch = useMemo(
    () => computeMentionMatch(disabled, isAutocompleteDismissed, slashMatch, sources, value, cursorPosition),
    [cursorPosition, disabled, isAutocompleteDismissed, slashMatch, sources, value],
  );

  function updateCursor(element: HTMLTextAreaElement) {
    setCursorPosition(element.selectionStart ?? element.value.length);
  }

  function applyInsertedToken(nextValue: string, nextCursor: number) {
    setValue(nextValue);
    setCursorPosition(nextCursor);
    setSelectedSuggestion(undefined);
    setIsAutocompleteDismissed(false);
    setHighlightedIndex(null);
    focusAndSetTextareaCaret(textareaRef, nextCursor);
  }

  function selectSuggestion(suggestion: AutocompleteSuggestion) {
    setValue(suggestion.value);
    setCursorPosition(suggestion.value.length);
    setSelectedSuggestion(suggestion);
    setIsAutocompleteDismissed(true);
    setHighlightedIndex(null);
    textareaRef.current?.focus();
  }

  function selectSlashCommand(command: SlashCommandDefinition) {
    if (!slashMatch) return;
    const { nextValue, nextCursor } = applySlashCommandSelection(value, slashMatch, command);
    applyInsertedToken(nextValue, nextCursor);
  }

  function selectFileMention(source: KnowledgeSource) {
    if (!mentionMatch) return;
    const { nextValue, nextCursor } = applyFileMentionSelection(value, mentionMatch, source);
    setMentionedSources((current) => appendMentionedSourceIfNew(current, source));
    applyInsertedToken(nextValue, nextCursor);
  }

  function handleRemoveMentionedSource(sourceId: string) {
    const target = mentionedSources.find((item) => item.id === sourceId);
    setMentionedSources((current) => current.filter((item) => item.id !== sourceId));
    const nextValue = stripRemovedSourceMention(value, target);
    if (nextValue === value) return;
    setValue(nextValue);
    setCursorPosition(nextValue.length);
    textareaRef.current?.focus();
  }

  function submit(rawOverride?: string) {
    const raw = (rawOverride ?? value).trim();
    if (!raw || disabled) return false;

    const args = buildSubmissionArgs({
      raw,
      sources,
      mentionedSources,
      hasPriorMessages,
      selectedSuggestion,
    });
    const accepted = onSubmit(args.promptToSend, args.suggestionArg, args.scopedDocArg);
    if (!accepted) return false;

    setValue("");
    setCursorPosition(0);
    setMentionedSources([]);
    setSelectedSuggestion(undefined);
    setIsAutocompleteDismissed(false);
    setHighlightedIndex(null);
    return true;
  }

  function handleTextareaChange(nextValue: string, element: HTMLTextAreaElement) {
    setValue(nextValue);
    updateCursor(element);
    setMentionedSources((current) => syncMentionedSourcesWithText(nextValue, current));
    setSelectedSuggestion(undefined);
    setIsAutocompleteDismissed(false);
    setHighlightedIndex(null);
  }

  return {
    textareaRef,
    value,
    mentionedSources,
    isAutocompleteDismissed,
    setIsAutocompleteDismissed,
    highlightedIndex,
    setHighlightedIndex,
    slashMatch,
    mentionMatch,
    updateCursor,
    selectSuggestion,
    selectSlashCommand,
    selectFileMention,
    handleRemoveMentionedSource,
    submit,
    handleTextareaChange,
  };
}

type ChatTextareaFieldProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  disabled: boolean;
  placeholderText: string;
  hasPlusMenu: boolean;
  sendOnEnter: boolean;
  anyComposerMenuOpen: boolean;
  isSlashMenuOpen: boolean;
  isMentionMenuOpen: boolean;
  isAutocompleteOpen: boolean;
  slashMatches: SlashCommandDefinition[];
  mentionMatches: KnowledgeSource[];
  autocompleteMatches: AutocompleteSuggestion[];
  activeListLength: number;
  boundedHighlightedIndex: number | null;
  onDismissMenu: () => void;
  onChangeHighlightedIndex: React.Dispatch<React.SetStateAction<number | null>>;
  onSelectSlashCommand: (command: SlashCommandDefinition) => void;
  onSelectFileMention: (source: KnowledgeSource) => void;
  onSelectSuggestion: (suggestion: AutocompleteSuggestion) => void;
  onSubmit: () => void;
  onChangeValue: (nextValue: string, element: HTMLTextAreaElement) => void;
  onUpdateCursor: (element: HTMLTextAreaElement) => void;
};

function ChatTextareaField({
  textareaRef,
  value,
  disabled,
  placeholderText,
  hasPlusMenu,
  sendOnEnter,
  anyComposerMenuOpen,
  isSlashMenuOpen,
  isMentionMenuOpen,
  isAutocompleteOpen,
  slashMatches,
  mentionMatches,
  autocompleteMatches,
  activeListLength,
  boundedHighlightedIndex,
  onDismissMenu,
  onChangeHighlightedIndex,
  onSelectSlashCommand,
  onSelectFileMention,
  onSelectSuggestion,
  onSubmit,
  onChangeValue,
  onUpdateCursor,
}: Readonly<ChatTextareaFieldProps>) {
  const textareaPaddingClass = hasPlusMenu ? "px-2" : "pl-3.5 pr-2";
  const placeholderPositionClass = hasPlusMenu ? "inset-x-2" : "left-3.5 right-2";

  return (
    <div className="relative min-w-0 flex-1">
      {!value && (
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-sm leading-5 text-slate-400 ${placeholderPositionClass}`}
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
        onChange={(event) => onChangeValue(event.target.value, event.currentTarget)}
        onClick={(event) => onUpdateCursor(event.currentTarget)}
        onKeyUp={(event) => {
          if (!KEY_UP_NAV_IGNORED.has(event.key)) {
            onUpdateCursor(event.currentTarget);
          }
        }}
        onKeyDown={(event) =>
          processTextareaKeyDown({
            event,
            value,
            sendOnEnter,
            anyComposerMenuOpen,
            isSlashMenuOpen,
            isMentionMenuOpen,
            isAutocompleteOpen,
            slashMatches,
            mentionMatches,
            autocompleteMatches,
            activeListLength,
            boundedHighlightedIndex,
            onDismissMenu,
            onChangeHighlightedIndex,
            onSelectSlashCommand,
            onSelectFileMention,
            onSelectSuggestion,
            onSubmit,
          })
        }
        className={`block max-h-36 min-h-9 w-full resize-none bg-transparent py-2 text-sm leading-5 text-slate-100 outline-hidden disabled:cursor-not-allowed disabled:opacity-60 ${textareaPaddingClass}`}
      />
    </div>
  );
}

export function ChatInput({
  autocompleteSuggestions = [],
  disabled = false,
  isResponding = false,
  focusedDocumentName = null,
  includeKnowledgeBase = true,
  knowledgeBaseCount,
  isTemporaryChat = false,
  hasPriorMessages = false,
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
  const hasPlusMenu = Boolean(onUploadFiles || onOpenUpload || onToggleKnowledgeBase);
  const hasSourcesMenu = sources !== undefined;

  const draft = useChatInputDraft({
    disabled,
    sources,
    hasPriorMessages,
    onSubmit,
  });

  const popovers = useChatInputPopovers({
    disabled,
    onUploadFiles,
    onOpenUpload,
  });

  const {
    selectableSourceCount,
    selectedSourceCount,
    selectedIdSet,
    sourceSections,
    sourcesButtonLabel,
  } = useMemo(
    () => buildSourcesSummary(sources, selectedSourceIds, includeKnowledgeBase),
    [includeKnowledgeBase, selectedSourceIds, sources],
  );

  const trie = useMemo(
    () => TrieAutocomplete.fromSuggestions(autocompleteSuggestions),
    [autocompleteSuggestions],
  );
  const matches = useMemo(
    () =>
      computeAutocompleteMatches(
        draft.value,
        disabled,
        Boolean(draft.slashMatch && draft.slashMatch.matches.length > 0),
        Boolean(draft.mentionMatch),
        trie,
      ),
    [disabled, draft.mentionMatch, draft.slashMatch, draft.value, trie],
  );

  const menuState = resolveComposerListLengths({
    slashMatchesCount: draft.slashMatch?.matches.length ?? 0,
    hasMentionMatch: Boolean(draft.mentionMatch),
    mentionMatchesCount: draft.mentionMatch?.matches.length ?? 0,
    autocompleteMatchesCount: matches.length,
    isAutocompleteDismissed: draft.isAutocompleteDismissed,
    highlightedIndex: draft.highlightedIndex,
    hasPlusMenu,
    isPlusMenuOpen: popovers.isPlusMenuOpen,
    hasSourcesMenu,
    isSourcesMenuOpen: popovers.isSourcesMenuOpen,
    disabled,
  });

  const handleQuickPracticeQuiz = () => {
    popovers.setIsPlusMenuOpen(false);
    draft.submit(buildQuizRawPrompt(draft.value));
  };

  const placeholderText = getInputPlaceholder(focusedDocumentName, isTemporaryChat, includeKnowledgeBase);
  const canUploadFiles = Boolean(onUploadFiles || onOpenUpload);

  return (
    <div
      style={{ backgroundColor: "var(--chat-input-bg, #161f33)" }}
      className="chat-input-surface pointer-events-auto relative z-20 mx-auto w-full max-w-4xl place-self-center rounded-[26px] border border-white/10 bg-[#161f33] p-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.34)] transition-[border-color] focus-within:border-cyan-400/50"
    >
      <ChatInputActivePopover
        isSlashMenuOpen={menuState.isSlashMenuOpen}
        isMentionMenuOpen={menuState.isMentionMenuOpen}
        isAutocompleteOpen={menuState.isAutocompleteOpen}
        slashMatches={draft.slashMatch?.matches ?? []}
        mentionMatches={draft.mentionMatch?.matches ?? []}
        autocompleteMatches={matches}
        hasAnySources={Boolean(sources?.length)}
        value={draft.value}
        boundedHighlightedIndex={menuState.boundedHighlightedIndex}
        onSelectSlashCommand={draft.selectSlashCommand}
        onSelectFileMention={draft.selectFileMention}
        onSelectSuggestion={draft.selectSuggestion}
      />

      <MentionedSourcesBar
        mentionedSources={draft.mentionedSources}
        onRemove={draft.handleRemoveMentionedSource}
      />
      <div className="flex items-end gap-1.5">
        <PlusMenuControl
          hasPlusMenu={hasPlusMenu}
          plusMenuRef={popovers.plusMenuRef}
          fileInputRef={popovers.fileInputRef}
          disabled={disabled}
          showPlusMenu={menuState.showPlusMenu}
          plusMenuPlacement={popovers.plusMenuPlacement}
          canUploadFiles={canUploadFiles}
          includeKnowledgeBase={includeKnowledgeBase}
          knowledgeBaseCount={knowledgeBaseCount}
          onUploadFiles={onUploadFiles}
          onFileSelection={popovers.handleFileSelection}
          onTogglePlusMenu={popovers.handleTogglePlusMenu}
          onTriggerUpload={popovers.handleTriggerFileUpload}
          onQuickPracticeQuiz={handleQuickPracticeQuiz}
          onCloseMenu={() => popovers.setIsPlusMenuOpen(false)}
          onToggleKnowledgeBase={onToggleKnowledgeBase}
        />
        <ChatTextareaField
          textareaRef={draft.textareaRef}
          value={draft.value}
          disabled={disabled}
          placeholderText={placeholderText}
          hasPlusMenu={hasPlusMenu}
          sendOnEnter={preferences.sendOnEnter}
          anyComposerMenuOpen={menuState.anyComposerMenuOpen}
          isSlashMenuOpen={menuState.isSlashMenuOpen}
          isMentionMenuOpen={menuState.isMentionMenuOpen}
          isAutocompleteOpen={menuState.isAutocompleteOpen}
          slashMatches={draft.slashMatch?.matches ?? []}
          mentionMatches={draft.mentionMatch?.matches ?? []}
          autocompleteMatches={matches}
          activeListLength={menuState.activeListLength}
          boundedHighlightedIndex={menuState.boundedHighlightedIndex}
          onDismissMenu={() => draft.setIsAutocompleteDismissed(true)}
          onChangeHighlightedIndex={draft.setHighlightedIndex}
          onSelectSlashCommand={draft.selectSlashCommand}
          onSelectFileMention={draft.selectFileMention}
          onSelectSuggestion={draft.selectSuggestion}
          onSubmit={draft.submit}
          onChangeValue={draft.handleTextareaChange}
          onUpdateCursor={draft.updateCursor}
        />
        <div className="flex shrink-0 items-center gap-1.5">
          <SourcesMenuControl
            hasSourcesMenu={hasSourcesMenu}
            sourcesMenuRef={popovers.sourcesMenuRef}
            disabled={disabled}
            showSourcesMenu={menuState.showSourcesMenu}
            sourcesMenuPlacement={popovers.sourcesMenuPlacement}
            sourcesButtonLabel={sourcesButtonLabel}
            sources={sources}
            sourceSections={sourceSections}
            selectedIdSet={selectedIdSet}
            selectableSourceCount={selectableSourceCount}
            selectedSourceCount={selectedSourceCount}
            collapsedSections={popovers.collapsedSections}
            canUploadFiles={canUploadFiles}
            onToggleSourcesMenu={popovers.handleToggleSourcesMenu}
            onTriggerUploadFromSources={() => {
              popovers.setIsSourcesMenuOpen(false);
              popovers.handleTriggerFileUpload();
            }}
            onSetAllSourcesSelected={onSetAllSourcesSelected}
            onToggleSectionCollapse={popovers.handleToggleSectionCollapse}
            onSetSectionSourcesSelected={onSetSectionSourcesSelected}
            onToggleSourceSelection={onToggleSourceSelection}
          />
          <SubmitOrStopButton
            disabled={disabled}
            isResponding={isResponding}
            hasValue={Boolean(draft.value.trim())}
            onStopResponse={onStopResponse}
            onSubmit={draft.submit}
          />
        </div>
      </div>
    </div>
  );
}
