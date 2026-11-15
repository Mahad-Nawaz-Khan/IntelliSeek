import { isSelectableSource, type KnowledgeSource } from "./ui-state";

export type SlashCommandId =
  | "quiz"
  | "summarize"
  | "concepts"
  | "explain"
  | "compare"
  | "exam"
  | "compact";

export type SlashCommandDefinition = {
  id: SlashCommandId;
  command: `/${SlashCommandId}`;
  label: string;
  description: string;
  usageHint: string;
  requiresArgs?: boolean;
};

export const SLASH_COMMANDS: readonly SlashCommandDefinition[] = [
  {
    id: "quiz",
    command: "/quiz",
    label: "Practice Quiz",
    description: "Generate an interactive multiple-choice quiz directly in chat",
    usageHint: "/quiz [topic or @file]",
    requiresArgs: false,
  },
  {
    id: "summarize",
    command: "/summarize",
    label: "Summarize",
    description: "Summarize key points and main takeaways",
    usageHint: "/summarize [@file or topic]",
    requiresArgs: false,
  },
  {
    id: "concepts",
    command: "/concepts",
    label: "Key Concepts",
    description: "Extract core definitions, formulas, and principles",
    usageHint: "/concepts [@file or topic]",
    requiresArgs: false,
  },
  {
    id: "explain",
    command: "/explain",
    label: "Explain",
    description: "Step-by-step explanation with intuition and examples",
    usageHint: "/explain <topic or @file>",
    requiresArgs: true,
  },
  {
    id: "compare",
    command: "/compare",
    label: "Compare",
    description: "Side-by-side comparison table and key differences",
    usageHint: "/compare <A> vs <B>",
    requiresArgs: true,
  },
  {
    id: "exam",
    command: "/exam",
    label: "Exam Prep",
    description: "High-yield exam and viva practice questions with model answers",
    usageHint: "/exam [@file or topic]",
    requiresArgs: false,
  },
  {
    id: "compact",
    command: "/compact",
    label: "Compact",
    description: "Condense this chat or topic into a compact TL;DR cheat-sheet",
    usageHint: "/compact [optional @file or topic]",
    requiresArgs: false,
  },
];

const COMMAND_BY_ID = new Map<string, SlashCommandDefinition>(
  SLASH_COMMANDS.map((cmd) => [cmd.id, cmd]),
);

export type SlashCommandMatch = {
  query: string;
  tokenStart: number;
  tokenEnd: number;
  matches: SlashCommandDefinition[];
};

export type FileMentionMatch = {
  query: string;
  tokenStart: number;
  tokenEnd: number;
  matches: KnowledgeSource[];
};

export type ResolvedSubmission = {
  promptToSend: string;
  displayPrompt: string;
  slashCommand?: SlashCommandId;
  mentionedSources: KnowledgeSource[];
  mentionedDocumentIds: string[];
};

function findTokenEnd(value: string, startIndex: number): number {
  let end = startIndex;
  while (end < value.length && !/\s/.test(value[end])) {
    end += 1;
  }
  return end;
}

export function getSlashCommandDefinition(id: string): SlashCommandDefinition | undefined {
  return COMMAND_BY_ID.get(id.toLowerCase());
}

/**
 * Detects an active `/command` token at the start of the composer input
 * before the user enters a trailing space.
 */
export function detectSlashCommandQuery(
  value: string,
  cursorPosition: number,
): SlashCommandMatch | null {
  const clampedCursor = Math.max(0, Math.min(cursorPosition, value.length));
  const beforeCursor = value.slice(0, clampedCursor);
  const match = /^(\s*)\/([a-zA-Z-]*)$/.exec(beforeCursor);
  if (!match) return null;

  const leadingSpaces = match[1] ?? "";
  const query = (match[2] ?? "").toLowerCase();
  const tokenStart = leadingSpaces.length;
  const tokenEnd = findTokenEnd(value, clampedCursor);

  const matches = SLASH_COMMANDS.filter((cmd) => {
    if (!query) return true;
    return cmd.id.startsWith(query) || cmd.label.toLowerCase().includes(query);
  });

  if (matches.length === 0) return null;

  return {
    query,
    tokenStart,
    tokenEnd,
    matches,
  };
}

export function applySlashCommandSelection(
  value: string,
  match: { tokenStart: number; tokenEnd: number },
  command: SlashCommandDefinition,
): { nextValue: string; nextCursor: number } {
  const prefix = value.slice(0, match.tokenStart);
  const suffix = value.slice(match.tokenEnd).replace(/^\s*/, "");
  const insertion = `${command.command} `;
  const nextValue = `${prefix}${insertion}${suffix}`;
  return {
    nextValue,
    nextCursor: prefix.length + insertion.length,
  };
}

/**
 * Detects an active `@file` mention token immediately before the cursor
 * (preceded by start of input or whitespace).
 */
export function detectFileMentionQuery(
  value: string,
  cursorPosition: number,
  sources: KnowledgeSource[],
): FileMentionMatch | null {
  const clampedCursor = Math.max(0, Math.min(cursorPosition, value.length));
  const beforeCursor = value.slice(0, clampedCursor);
  const match = /(?:^|\s)@([^\s@]*)$/.exec(beforeCursor);
  if (!match) return null;

  const fullMatch = match[0];
  const atOffsetInMatch = fullMatch.lastIndexOf("@");
  const tokenStart = beforeCursor.length - (fullMatch.length - atOffsetInMatch);
  const tokenEnd = findTokenEnd(value, clampedCursor);
  const query = match[1] ?? "";
  const normalizedQuery = query.toLowerCase();

  const selectable = sources.filter(isSelectableSource);
  const filtered = selectable.filter((source) =>
    normalizedQuery ? source.filename.toLowerCase().includes(normalizedQuery) : true,
  );

  filtered.sort((a, b) => {
    const aIndexed = a.status === "indexed" ? 0 : 1;
    const bIndexed = b.status === "indexed" ? 0 : 1;
    if (aIndexed !== bIndexed) return aIndexed - bIndexed;

    if (normalizedQuery) {
      const aStarts = a.filename.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      const bStarts = b.filename.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
    }

    if (a.sourceType !== b.sourceType) {
      return a.sourceType === "uploaded" ? -1 : 1;
    }

    return a.filename.localeCompare(b.filename, undefined, { sensitivity: "base" });
  });

  return {
    query,
    tokenStart,
    tokenEnd,
    matches: filtered.slice(0, 12),
  };
}

export function applyFileMentionSelection(
  value: string,
  match: { tokenStart: number; tokenEnd: number },
  source: KnowledgeSource,
): { nextValue: string; nextCursor: number } {
  const prefix = value.slice(0, match.tokenStart);
  const rawSuffix = value.slice(match.tokenEnd);
  const suffix = rawSuffix.replace(/^\s*/, "");
  const insertion = `@${source.filename} `;
  const nextValue = `${prefix}${insertion}${suffix}`;
  return {
    nextValue,
    nextCursor: prefix.length + insertion.length,
  };
}

export function syncMentionedSourcesWithText(
  text: string,
  attachedMentions: KnowledgeSource[],
): KnowledgeSource[] {
  if (!attachedMentions.length) return attachedMentions;
  const lower = text.toLowerCase();
  return attachedMentions.filter((source) =>
    lower.includes(`@${source.filename.toLowerCase()}`),
  );
}

function hasBoundedMention(lowerText: string, filename: string): boolean {
  const mentionNeedle = `@${filename.toLowerCase()}`;
  let searchFrom = 0;
  while (searchFrom < lowerText.length) {
    const idx = lowerText.indexOf(mentionNeedle, searchFrom);
    if (idx === -1) return false;
    const charBefore = idx === 0 ? " " : lowerText[idx - 1];
    const endIdx = idx + mentionNeedle.length;
    const charAfter = endIdx >= lowerText.length ? " " : lowerText[endIdx];
    if (/\s/.test(charBefore) && /[\s.,!?;:)\]]/.test(charAfter)) {
      return true;
    }
    searchFrom = idx + 1;
  }
  return false;
}

export function extractMentionedSourcesFromText(
  text: string,
  sources: KnowledgeSource[],
  attachedMentions: KnowledgeSource[] = [],
): KnowledgeSource[] {
  const byId = new Map<string, KnowledgeSource>();
  const lower = text.toLowerCase();

  for (const source of attachedMentions) {
    if (isSelectableSource(source) && lower.includes(`@${source.filename.toLowerCase()}`)) {
      byId.set(source.id, source);
    }
  }

  // Sort longer filenames first so substring filenames don't shadow longer exact matches
  const selectableSorted = [...sources]
    .filter(isSelectableSource)
    .sort((a, b) => b.filename.length - a.filename.length);

  for (const source of selectableSorted) {
    if (!byId.has(source.id) && hasBoundedMention(lower, source.filename)) {
      byId.set(source.id, source);
    }
  }

  return Array.from(byId.values());
}

export function parseExactSlashCommandInput(rawText: string): {
  command?: SlashCommandDefinition;
  args: string;
} {
  const trimmed = rawText.trim();
  const match = /^\/([a-zA-Z-]+)(?:\s+([\s\S]*))?$/.exec(trimmed);
  if (!match) return { args: trimmed };
  const cmd = getSlashCommandDefinition(match[1]);
  if (!cmd) return { args: trimmed };
  return {
    command: cmd,
    args: (match[2] ?? "").trim(),
  };
}

function formatMentionedNames(mentionedSources: KnowledgeSource[]): string {
  return mentionedSources.map((source) => source.filename).join(", ");
}

function mergeResolvedMentions(
  attachedMentions: KnowledgeSource[],
  mentionedSources: KnowledgeSource[],
): KnowledgeSource[] {
  const finalMentionMap = new Map<string, KnowledgeSource>();
  for (const source of attachedMentions) {
    if (isSelectableSource(source)) finalMentionMap.set(source.id, source);
  }
  for (const source of mentionedSources) {
    finalMentionMap.set(source.id, source);
  }
  return Array.from(finalMentionMap.values());
}

type CommandPromptTemplate = {
  withArgs: (args: string) => string;
  withMentions: (names: string) => string;
  fallback: string;
};

const COMMAND_PROMPT_TEMPLATES: Record<SlashCommandId, CommandPromptTemplate> = {
  quiz: {
    withArgs: (args) => `/quiz ${args}`,
    withMentions: (names) => `/quiz Create an interactive multiple-choice quiz based on ${names}.`,
    fallback: "/quiz Create an interactive multiple-choice quiz based on my study material.",
  },
  summarize: {
    withArgs: (args) => `Summarize the key points and main takeaways: ${args}`,
    withMentions: (names) => `Summarize the key points and main takeaways of ${names}.`,
    fallback: "Summarize the key points and main takeaways of my uploaded study material.",
  },
  concepts: {
    withArgs: (args) => `Extract the core concepts, key definitions, and important formulas from ${args}.`,
    withMentions: (names) =>
      `Extract the core concepts, key definitions, and important formulas covered in ${names}.`,
    fallback: "Extract the core concepts, key definitions, and important formulas from my study material.",
  },
  explain: {
    withArgs: (args) => `Explain ${args} step by step with intuition, key definitions, and a concrete example.`,
    withMentions: (names) =>
      `Explain the main concepts covered in ${names} step by step with intuition and clear examples.`,
    fallback: "Explain the key concepts in my study material step by step with intuition and clear examples.",
  },
  compare: {
    withArgs: (args) => `Compare ${args} using a structured side-by-side comparison table and key takeaways.`,
    withMentions: (names) =>
      `Compare the main topics and approaches covered in ${names} using a clear comparison table.`,
    fallback: "Compare the major concepts covered in my study material using a clear side-by-side comparison table.",
  },
  exam: {
    withArgs: (args) =>
      `Create high-yield exam and viva practice questions with detailed model answers for ${args}.`,
    withMentions: (names) =>
      `Create high-yield exam and viva practice questions with detailed model answers based on ${names}.`,
    fallback:
      "Create high-yield exam and viva practice questions with detailed model answers from my study material.",
  },
  compact: {
    withArgs: (args) =>
      `Create an ultra-compact TL;DR cheat-sheet summary of the key points, formulas, and definitions for ${args}.`,
    withMentions: (names) =>
      `Create an ultra-compact TL;DR cheat-sheet summary of the key points, formulas, and definitions in ${names}.`,
    fallback:
      "Create an ultra-compact TL;DR cheat-sheet summary of the key points, formulas, and definitions from my study material.",
  },
};

function buildSlashCommandPrompt(
  commandId: SlashCommandId,
  args: string,
  mentionedNames: string,
  hasMentions: boolean,
  hasPriorMessages: boolean,
): string {
  if (commandId === "compact" && !args && !hasMentions && hasPriorMessages) {
    return "Condense our conversation so far into a compact, scannable cheat-sheet summary of key takeaways, definitions, and conclusions.";
  }

  const template = COMMAND_PROMPT_TEMPLATES[commandId];
  if (args) return template.withArgs(args);
  if (mentionedNames) return template.withMentions(mentionedNames);
  return template.fallback;
}

export function resolveSubmissionCommands(
  rawQuestion: string,
  sources: KnowledgeSource[] = [],
  attachedMentions: KnowledgeSource[] = [],
  hasPriorMessages = false,
): ResolvedSubmission {
  const trimmed = rawQuestion.trim();
  const mentionedSources = extractMentionedSourcesFromText(trimmed, sources, attachedMentions);
  // Also retain attachedMentions whose chips are still shown in case the user removed inline text or chip was attached directly
  const resolvedMentions = mergeResolvedMentions(attachedMentions, mentionedSources);
  const mentionedDocumentIds = resolvedMentions.map((source) => source.id);
  const mentionedNames = formatMentionedNames(resolvedMentions);

  const { command, args } = parseExactSlashCommandInput(trimmed);
  if (!command) {
    return {
      promptToSend: trimmed,
      displayPrompt: trimmed,
      mentionedSources: resolvedMentions,
      mentionedDocumentIds,
    };
  }

  const promptToSend = buildSlashCommandPrompt(
    command.id,
    args,
    mentionedNames,
    resolvedMentions.length > 0,
    hasPriorMessages,
  );

  return {
    promptToSend,
    displayPrompt: trimmed,
    slashCommand: command.id,
    mentionedSources: resolvedMentions,
    mentionedDocumentIds,
  };
}
