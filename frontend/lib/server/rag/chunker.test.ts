import { describe, expect, it } from "vitest";
import {
  chunkText,
  microChunkText,
  normalizeText,
  splitIntoSentences,
} from "./chunker";

describe("chunker", () => {
  it("normalizes text whitespace and line endings", () => {
    const raw = "Hello\r\nworld!  \t  This   is    IntelliSeek.\n\n\n\nNew paragraph.";
    const normalized = normalizeText(raw);
    expect(normalized).not.toContain("\r");
    expect(normalized).not.toContain("  ");
    expect(normalized).toContain("\n\nNew paragraph.");
  });

  it("splits text into sentences properly", () => {
    const text =
      "Binary search is efficient. It runs in O(log n) time. Is it faster than linear search? Yes, significantly.";
    const sentences = splitIntoSentences(text);
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences[0]).toBe("Binary search is efficient.");
  });

  it("chunks structured text respecting headings", () => {
    const text = `# Introduction to Trees\nTrees are hierarchical data structures.\n\n# Binary Search Trees\nA binary search tree satisfies the BST property where left is smaller and right is larger.\n\n# AVL Trees\nAVL trees maintain self-balancing property with rotations.`;
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]).toContain("Trees");
  });

  it("generates micro-chunks with corresponding parent chunk indexes", () => {
    const text = `Data structures are essential in computer science. They allow organized data storage. Algorithms operate upon these structures.\n\nGraph algorithms such as Dijkstra and Bellman-Ford find shortest paths. A minimum spanning tree can be found with Kruskal or Prim algorithm.`;
    const micro = microChunkText(text);
    expect(micro.length).toBeGreaterThan(0);
    micro.forEach((mc) => {
      expect(mc.parentChunkIndex).toBeGreaterThanOrEqual(0);
      expect(mc.text.length).toBeGreaterThan(0);
    });
  });
});

