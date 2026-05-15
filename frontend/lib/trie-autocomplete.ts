export type AutocompleteSuggestionType = "prompt" | "document" | "history";

export type AutocompleteSuggestion = {
  id: string;
  label: string;
  value: string;
  type: AutocompleteSuggestionType;
};

type TrieNode = {
  children: Map<string, TrieNode>;
  suggestions: AutocompleteSuggestion[];
};

const TYPE_PRIORITY: Record<AutocompleteSuggestionType, number> = {
  prompt: 0,
  document: 1,
  history: 2,
};

function createNode(): TrieNode {
  return {
    children: new Map(),
    suggestions: [],
  };
}

function normalize(input: string) {
  return input.toLocaleLowerCase().replace(/\s+/g, " ").trim();
}

function compareSuggestions(a: AutocompleteSuggestion, b: AutocompleteSuggestion) {
  const typeDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
  if (typeDiff !== 0) return typeDiff;

  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

export class TrieAutocomplete {
  private root = createNode();
  private seen = new Set<string>();

  static fromSuggestions(suggestions: AutocompleteSuggestion[]) {
    const trie = new TrieAutocomplete();
    suggestions.forEach((suggestion) => trie.insert(suggestion));
    return trie;
  }

  insert(suggestion: AutocompleteSuggestion) {
    const key = normalize(suggestion.value);
    if (!key) return;

    const uniqueKey = `${suggestion.type}:${key}`;
    if (this.seen.has(uniqueKey)) return;
    this.seen.add(uniqueKey);

    let node = this.root;
    for (const char of key) {
      const next = node.children.get(char) ?? createNode();
      node.children.set(char, next);
      node = next;
    }

    node.suggestions.push(suggestion);
    node.suggestions.sort(compareSuggestions);
  }

  search(prefix: string, limit = 6) {
    const key = normalize(prefix);
    if (!key) return [];

    let node = this.root;
    for (const char of key) {
      const next = node.children.get(char);
      if (!next) return [];
      node = next;
    }

    const results: AutocompleteSuggestion[] = [];
    this.collect(node, results, limit);
    return results.sort(compareSuggestions).slice(0, limit);
  }

  private collect(node: TrieNode, results: AutocompleteSuggestion[], limit: number) {
    if (results.length >= limit) return;

    results.push(...node.suggestions.slice(0, limit - results.length));
    if (results.length >= limit) return;

    const children = [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, child] of children) {
      this.collect(child, results, limit);
      if (results.length >= limit) return;
    }
  }
}
