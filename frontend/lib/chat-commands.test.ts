import { describe, expect, it } from "vitest";

import {
  applyFileMentionSelection,
  applySlashCommandSelection,
  detectFileMentionQuery,
  detectSlashCommandQuery,
  extractMentionedSourcesFromText,
  resolveSubmissionCommands,
  SLASH_COMMANDS,
  syncMentionedSourcesWithText,
} from "./chat-commands";
import type { KnowledgeSource } from "./ui-state";

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    filename: "lecture-notes.pdf",
    sourceType: "uploaded",
    status: "indexed",
    ...overrides,
  };
}

describe("chat-commands", () => {
  it("detects leading slash queries and filters matching commands", () => {
    const all = detectSlashCommandQuery("/", 1);
    expect(all).not.toBeNull();
    expect(all?.matches.map((m) => m.id)).toEqual(SLASH_COMMANDS.map((c) => c.id));

    const filtered = detectSlashCommandQuery("/comp", 5);
    expect(filtered?.query).toBe("comp");
    expect(filtered?.matches.map((m) => m.id)).toEqual(["compare", "compact"]);

    // Once space is entered, slash picker closes
    expect(detectSlashCommandQuery("/quiz ", 6)).toBeNull();
    // Non-leading slash does not trigger command picker
    expect(detectSlashCommandQuery("Explain a/b", 11)).toBeNull();
  });

  it("applies slash command selection cleanly at token bounds", () => {
    const quiz = SLASH_COMMANDS.find((c) => c.id === "quiz")!;
    const match = detectSlashCommandQuery("/qu trees", 3)!;
    const applied = applySlashCommandSelection("/qu trees", match, quiz);
    expect(applied.nextValue).toBe("/quiz trees");
    expect(applied.nextCursor).toBe("/quiz ".length);
  });

  it("detects @ file mentions, skips emails, and ranks indexed uploads first", () => {
    const sources: KnowledgeSource[] = [
      makeSource({ id: "kb-1", filename: "syllabus.pdf", sourceType: "knowledge-base", status: "indexed" }),
      makeSource({ id: "up-1", filename: "avl-trees.pdf", sourceType: "uploaded", status: "indexed" }),
      makeSource({ id: "up-fail", filename: "avl-broken.pdf", sourceType: "uploaded", status: "failed" }),
      makeSource({ id: "up-indexing", filename: "avl-draft.md", sourceType: "uploaded", status: "indexing" }),
    ];

    expect(detectFileMentionQuery("email me@test.com", 17, sources)).toBeNull();

    const emptyQuery = detectFileMentionQuery("/quiz @", 7, sources);
    expect(emptyQuery?.matches.map((m) => m.id)).toEqual(["up-1", "kb-1", "up-indexing"]);

    const filtered = detectFileMentionQuery("Compare rotations in @avl", 25, sources);
    expect(filtered?.query).toBe("avl");
    expect(filtered?.matches.map((m) => m.id)).toEqual(["up-1", "up-indexing"]);

    const applied = applyFileMentionSelection("Compare rotations in @avl please", filtered!, sources[1]);
    expect(applied.nextValue).toBe("Compare rotations in @avl-trees.pdf please");
  });

  it("syncs and extracts inline @mentions including filenames with spaces", () => {
    const sources: KnowledgeSource[] = [
      makeSource({ id: "doc-a", filename: "DSA Lecture 1.pdf" }),
      makeSource({ id: "doc-b", filename: "Graphs.md", sourceType: "knowledge-base" }),
    ];

    const extracted = extractMentionedSourcesFromText("Summarize @DSA Lecture 1.pdf and @Graphs.md.", sources);
    expect(extracted.map((s) => s.id)).toEqual(["doc-a", "doc-b"]);

    expect(syncMentionedSourcesWithText("Summarize @Graphs.md.", extracted).map((s) => s.id)).toEqual(["doc-b"]);
  });

  it("resolves all 7 slash commands and extracts scoped document IDs", () => {
    const sources: KnowledgeSource[] = [
      makeSource({ id: "doc-1", filename: "Trees.pdf" }),
      makeSource({ id: "doc-2", filename: "Heaps.pdf" }),
    ];

    const quizWithMention = resolveSubmissionCommands("/quiz @Trees.pdf", sources, [sources[0]], false);
    expect(quizWithMention.slashCommand).toBe("quiz");
    expect(quizWithMention.promptToSend).toBe("/quiz @Trees.pdf");
    expect(quizWithMention.mentionedDocumentIds).toEqual(["doc-1"]);

    const bareQuiz = resolveSubmissionCommands("/quiz", sources, [], false);
    expect(bareQuiz.promptToSend).toContain("/quiz Create an interactive multiple-choice quiz");

    expect(resolveSubmissionCommands("/summarize @Trees.pdf", sources, [], false).promptToSend).toContain(
      "Summarize the key points",
    );
    expect(resolveSubmissionCommands("/concepts heaps", sources, [], false).promptToSend).toContain(
      "Extract the core concepts",
    );
    expect(resolveSubmissionCommands("/explain recursion", sources, [], false).promptToSend).toContain(
      "Explain recursion step by step",
    );
    expect(resolveSubmissionCommands("/compare BFS vs DFS", sources, [], false).promptToSend).toContain(
      "Compare BFS vs DFS using a structured side-by-side comparison table",
    );
    expect(resolveSubmissionCommands("/exam @Heaps.pdf", sources, [], false).promptToSend).toContain(
      "Create high-yield exam and viva practice questions",
    );

    const compactHistory = resolveSubmissionCommands("/compact", sources, [], true);
    expect(compactHistory.promptToSend).toContain("Condense our conversation so far");

    const compactTopic = resolveSubmissionCommands("/compact @Heaps.pdf", sources, [], true);
    expect(compactTopic.promptToSend).toContain("ultra-compact TL;DR cheat-sheet summary");
  });
});
