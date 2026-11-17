import { describe, expect, it } from "vitest";
import { extractKeyphrases } from "./keyphrase-extractor";

describe("keyphrase-extractor", () => {
  it("extracts definitions, acronyms, and capitalized terms", () => {
    const chunks = [
      "Binary Search Tree is defined as a node-based binary tree data structure with the BST property.",
      "ACID refers to Atomicity, Consistency, Isolation, and Durability in database management.",
      "Dynamic Programming solves complex problems by breaking them down into simpler subproblems.",
    ];

    const keyphrases = extractKeyphrases(chunks);
    const phrases = keyphrases.map((k) => k.phrase.toLowerCase());

    expect(phrases.some((p) => p.includes("binary search tree") || p.includes("acid"))).toBe(true);
  });

  it("extracts refers-to, means, and denotes definition patterns cleanly", () => {
    const chunks = [
      "Hash Table refers to an associative data structure. Memoization means caching computed subproblem outputs. Asymptotic Bound denotes limiting runtime growth.",
    ];

    const keyphrases = extractKeyphrases(chunks);
    const definitions = keyphrases
      .filter((k) => k.source === "definition")
      .map((k) => k.phrase.toLowerCase());

    expect(definitions).toContain("hash table");
    expect(definitions).toContain("memoization");
    expect(definitions).toContain("asymptotic bound");
  });
});

