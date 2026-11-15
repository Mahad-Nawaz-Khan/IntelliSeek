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
    if (byId.has(source.id)) continue;
    const mentionNeedle = `@${source.filename.toLowerCase()}`;
    let searchFrom = 0;
    while (searchFrom < lower.length) {
      const idx = lower.indexOf(mentionNeedle, searchFrom);
      if (idx === -1) break;
      const charBefore = idx === 0 ? " " : lower[idx - 1];
      const endIdx = idx + mentionNeedle.length;
      const charAfter = endIdx >= lower.length ? " " : lower[endIdx];
      const validBefore = /\s/.test(charBefore);
      const validAfter = /[\s.,!?;:)\]]/.test(charAfter);
      if (validBefore && validAfter) {
        byId.set(source.id, source);
        break;
      }
      searchFrom = idx + 1;
    }
  }

  // Preserve any explicitly attached mentions even if text was edited manually before sending
  for (const source of attachedMentions) {
    if (isSelectableSource(source) && !byId.has(source.id)) {
      // Only keep if attachedMentions still matches text OR if caller deliberately kept chip
      if (lower.includes(`@${source.filename.toLowerCase()}`)) {
        byId.set(source.id, source);
      }
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

export function resolveSubmissionCommands(
  rawQuestion: string,
  sources: KnowledgeSource[] = [],
  attachedMentions: KnowledgeSource[] = [],
  hasPriorMessages = false,
): ResolvedSubmission {
  const trimmed = rawQuestion.trim();
  const mentionedSources = extractMentionedSourcesFromText(trimmed, sources, attachedMentions);
  // Also retain attachedMentions whose chips are still shown in case the user removed inline text or chip was attached directly
  const finalMentionMap = new Map<string, KnowledgeSource>();
  for (const source of attachedMentions) {
    if (isSelectableSource(source)) finalMentionMap.set(source.id, source);
  }
  for (const source of mentionedSources) {
    finalMentionMap.set(source.id, source);
  }
  const resolvedMentions = Array.from(finalMentionMap.values());
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

  let promptToSend = trimmed;
  switch (command.id) {
    case "quiz": {
      if (args) {
        promptToSend = `/quiz ${args}`;
      } else if (mentionedNames) {
        promptToSend = `/quiz Create an interactive multiple-choice quiz based on ${mentionedNames}.`;
      } else {
        promptToSend = "/quiz Create an interactive multiple-choice quiz based on my study material.";
      }
      break;
    }
    case "summarize": {
      if (args) {
        promptToSend = `Summarize the key points and main takeaways: ${args}`;
      } else if (mentionedNames) {
        promptToSend = `Summarize the key points and main takeaways of ${mentionedNames}.`;
      } else {
        promptToSend = "Summarize the key points and main takeaways of my uploaded study material.";
      }
      break;
    }
    case "concepts": {
      if (args) {
        promptToSend = `Extract the core concepts, key definitions, and important formulas from ${args}.`;
      } else if (mentionedNames) {
        promptToSend = `Extract the core concepts, key definitions, and important formulas covered in ${mentionedNames}.`;
      } else {
        promptToSend = "Extract the core concepts, key definitions, and important formulas from my study material.";
      }
      break;
    }
    case "explain": {
      if (args) {
        promptToSend = `Explain ${args} step by step with intuition, key definitions, and a concrete example.`;
      } else if (mentionedNames) {
        promptToSend = `Explain the main concepts covered in ${mentionedNames} step by step with intuition and clear examples.`;
      } else {
        promptToSend = "Explain the key concepts in my study material step by step with intuition and clear examples.";
      }
      break;
    }
    case "compare": {
      if (args) {
        promptToSend = `Compare ${args} using a structured side-by-side comparison table and key takeaways.`;
      } else if (mentionedNames) {
        promptToSend = `Compare the main topics and approaches covered in ${mentionedNames} using a clear comparison table.`;
      } else {
        promptToSend = "Compare the major concepts covered in my study material using a clear side-by-side comparison table.";
      }
      break;
    }
    case "exam": {
      if (args) {
        promptToSend = `Create high-yield exam and viva practice questions with detailed model answers for ${args}.`;
      } else if (mentionedNames) {
        promptToSend = `Create high-yield exam and viva practice questions with detailed model answers based on ${mentionedNames}.`;
      } else {
        promptToSend = "Create high-yield exam and viva practice questions with detailed model answers from my study material.";
      }
      break;
    }
    case "compact": {
      if (!args && !resolvedMentions.length && hasPriorMessages) {
        promptToSend =
          "Condense our conversation so far into a compact, scannable cheat-sheet summary of key takeaways, definitions, and conclusions.";
      } else if (args) {
        promptToSend = `Create an ultra-compact TL;DR cheat-sheet summary of the key points, formulas, and definitions for ${args}.`;
      } else if (mentionedNames) {
        promptToSend = `Create an ultra-compact TL;DR cheat-sheet summary of the key points, formulas, and definitions in ${mentionedNames}.`;
      } else {
        promptToSend =
          "Create an ultra-compact TL;DR cheat-sheet summary of the key points, formulas, and definitions from my study material.";
      }
      break;
    }
  }

  return {
    promptToSend,
    displayPrompt: trimmed,
    slashCommand: command.id,
    mentionedSources: resolvedMentions,
    mentionedDocumentIds,
  };
}
