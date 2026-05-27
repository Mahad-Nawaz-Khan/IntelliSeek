export type AutocompleteSuggestionType = "prompt" | "topic" | "document" | "history";

export type AutocompleteSuggestion = {
  id: string;
  label: string;
  value: string;
  type: AutocompleteSuggestionType;
  keywords?: string[];
};

type TrieNode = {
  children: Map<string, TrieNode>;
  suggestions: AutocompleteSuggestion[];
};

const TYPE_PRIORITY: Record<AutocompleteSuggestionType, number> = {
  prompt: 0,
  topic: 1,
  document: 2,
  history: 3,
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
    const keys = [suggestion.value, ...(suggestion.keywords ?? [])].map(normalize).filter(Boolean);
    if (!keys.length) return;

    const uniqueKey = `${suggestion.type}:${normalize(suggestion.value)}`;
    if (this.seen.has(uniqueKey)) return;
    this.seen.add(uniqueKey);

    keys.forEach((key) => {
      let node = this.root;
      for (const char of key) {
        const next = node.children.get(char) ?? createNode();
        node.children.set(char, next);
        node = next;
      }

      node.suggestions.push(suggestion);
      node.suggestions.sort(compareSuggestions);
    });
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
