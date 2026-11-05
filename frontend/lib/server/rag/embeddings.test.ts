import { beforeEach, describe, expect, it } from "vitest";
import {
  clearEmbeddingCache,
  getCachedEmbedding,
  setCachedEmbedding,
} from "./embeddings";

describe("embedding query cache", () => {
  beforeEach(() => {
    clearEmbeddingCache();
  });

  it("stores and retrieves cached embeddings by query text", () => {
    const fakeVector = new Array(1024).fill(0.123);
    setCachedEmbedding("what is binary search", fakeVector);

    const retrieved = getCachedEmbedding("  What is Binary Search?  ");
    // Normalize ignores case and extra spaces
    expect(retrieved).not.toBeNull();
    expect(retrieved?.[0]).toBe(0.123);
  });

  it("returns null for uncached queries", () => {
    expect(getCachedEmbedding("non existent query")).toBeNull();
  });
});

