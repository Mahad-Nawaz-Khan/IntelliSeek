export type AutocompleteSuggestionType = "prompt" | "topic" | "document" | "history";

export type AutocompleteSuggestionMetadata =
  | {
      source: "uploaded";
      kind: "document";
      documentId: string;
    }
  | {
      source: "uploaded";
      kind: "topic";
      topic: string;
      topicId?: string;
      documentIds: string[];
    };

export type AutocompleteSuggestion = {
  id: string;
  label: string;
  value: string;
  type: AutocompleteSuggestionType;
  keywords?: string[];
  metadata?: AutocompleteSuggestionMetadata;
};

type TrieNode = {
  children: Map<string, TrieNode>;
  suggestions: AutocompleteSuggestion[];
};

const TYPE_PRIORITY: Record<AutocompleteSuggestionType, number> = {
  topic: 0,
  document: 1,
  history: 2,
  prompt: 3,
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

function tokenize(input: string) {
  return normalize(input)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function getSearchableText(suggestion: AutocompleteSuggestion) {
  return normalize([suggestion.value, suggestion.label, ...(suggestion.keywords ?? [])].join(" "));
}

function scoreSuggestion(suggestion: AutocompleteSuggestion, query: string) {
  const normalizedValue = normalize(suggestion.value);
  const normalizedLabel = normalize(suggestion.label);
  const normalizedKeywords = (suggestion.keywords ?? []).map(normalize);
  const searchable = getSearchableText(suggestion);
  const queryTokens = tokenize(query);

  if (!queryTokens.length) return Number.NEGATIVE_INFINITY;

  let score = 0;

  if (normalizedValue.startsWith(query)) score += 100;
  if (normalizedLabel.startsWith(query)) score += 90;
  if (normalizedKeywords.some((keyword) => keyword.startsWith(query))) score += 85;
  if (normalizedValue.includes(query)) score += 55;
  if (normalizedLabel.includes(query)) score += 45;
  if (normalizedKeywords.some((keyword) => keyword.includes(query))) score += 50;

  const missingToken = queryTokens.some((token) => !searchable.includes(token));
  if (missingToken) return Number.NEGATIVE_INFINITY;

  score += queryTokens.length * 12;
  score -= TYPE_PRIORITY[suggestion.type] * 4;
  score -= Math.min(normalizedValue.length, 160) / 80;

  return score;
}

function compareSuggestions(a: AutocompleteSuggestion, b: AutocompleteSuggestion) {
  const typeDiff = TYPE_PRIORITY[a.type] - TYPE_PRIORITY[b.type];
  if (typeDiff !== 0) return typeDiff;

  return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
}

export class TrieAutocomplete {
  private root = createNode();
  private seen = new Set<string>();
  private suggestions: AutocompleteSuggestion[] = [];

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
    this.suggestions.push(suggestion);

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

    const rankedFallback = this.suggestions
      .map((suggestion) => ({ suggestion, score: scoreSuggestion(suggestion, key) }))
      .filter((result) => Number.isFinite(result.score))
      .sort((a, b) => b.score - a.score || compareSuggestions(a.suggestion, b.suggestion))
      .map((result) => result.suggestion);

    let node = this.root;
    for (const char of key) {
      const next = node.children.get(char);
      if (!next) return rankedFallback.slice(0, limit);
      node = next;
    }

    const results: AutocompleteSuggestion[] = [];
    this.collect(node, results, limit);
    const seen = new Set(results.map((suggestion) => suggestion.id));
    rankedFallback.forEach((suggestion) => {
      if (!seen.has(suggestion.id)) results.push(suggestion);
    });
    return results
      .map((suggestion) => ({ suggestion, score: scoreSuggestion(suggestion, key) }))
      .sort((a, b) => b.score - a.score || compareSuggestions(a.suggestion, b.suggestion))
      .map((result) => result.suggestion)
      .slice(0, limit);
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
