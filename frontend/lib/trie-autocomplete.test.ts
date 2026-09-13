import { describe, expect, it } from "vitest";

import { TrieAutocomplete, type AutocompleteSuggestion } from "./trie-autocomplete";

const suggestions: AutocompleteSuggestion[] = [
  {
    id: "prompt:bst",
    label: "Explain Binary Search Trees",
    value: "Explain Binary Search Trees",
    type: "prompt",
  },
  {
    id: "prompt:avl",
    label: "Compare AVL and Red-Black trees",
    value: "Compare AVL and Red-Black trees",
    type: "prompt",
  },
  {
    id: "prompt:quick",
    label: "How does quicksort work?",
    value: "How does quicksort work?",
    type: "prompt",
  },
  {
    id: "prompt:hash",
    label: "Explain hash tables",
    value: "Explain hash tables",
    type: "prompt",
  },
  {
    id: "doc:1",
    label: "lecture-notes.pdf",
    value: "lecture-notes.pdf",
    type: "document",
    metadata: { source: "uploaded", kind: "document", documentId: "doc-1" },
  },
  {
    id: "topic:1",
    label: "binary search",
    value: "binary search",
    type: "topic",
    metadata: { source: "uploaded", kind: "topic", topic: "binary search", documentIds: ["doc-1"] },
  },
];

function search(prefix: string, limit?: number) {
  const trie = TrieAutocomplete.fromSuggestions(suggestions);
  const results = limit === undefined ? trie.search(prefix) : trie.search(prefix, limit);
  return results.map((suggestion) => suggestion.label);
}

describe("TrieAutocomplete", () => {
  it("matches words in the middle of a prompt, not just its first word", () => {
    expect(search("bin")).toEqual(["binary search", "Explain Binary Search Trees"]);
  });

  it("ranks a multi-word query across all of its tokens", () => {
    expect(search("binary search")).toEqual(["binary search", "Explain Binary Search Trees"]);
  });

  it("finds each suggestion by a distinctive prefix", () => {
    expect(search("avl")).toEqual(["Compare AVL and Red-Black trees"]);
    expect(search("hash")).toEqual(["Explain hash tables"]);
    expect(search("quick")).toEqual(["How does quicksort work?"]);
    expect(search("lecture")).toEqual(["lecture-notes.pdf"]);
  });

  it("returns nothing for noise or single characters", () => {
    expect(search("xy")).toEqual([]);
    expect(search("a")).toEqual([]);
    expect(search("")).toEqual([]);
  });

  it("collects every suggestion sharing the token", () => {
    expect(search("tree").sort()).toEqual([
      "Compare AVL and Red-Black trees",
      "Explain Binary Search Trees",
    ]);
  });

  it("caps results at the requested limit", () => {
    expect(search("ex", 1)).toHaveLength(1);
  });

  it("dedupes suggestions inserted twice", () => {
    const topic: AutocompleteSuggestion = {
      id: "topic:dup",
      label: "binary search",
      value: "binary search",
      type: "topic",
    };
    const trie = new TrieAutocomplete();
    trie.insert(topic);
    trie.insert({ ...topic });
    expect(trie.search("bin")).toHaveLength(1);
  });

  it("skips suggestions with no indexable text", () => {
    const trie = new TrieAutocomplete();
    trie.insert({ id: "junk", label: "!!!", value: "!!!", type: "prompt" });
    expect(trie.search("!!!")).toEqual([]);
  });
});
