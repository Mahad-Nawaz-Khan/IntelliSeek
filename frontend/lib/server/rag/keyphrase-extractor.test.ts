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
});

