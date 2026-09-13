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

  static fromSuggestions(suggestions: AutocompleteSuggestion[]) {
    const trie = new TrieAutocomplete();
    suggestions.forEach((suggestion) => trie.insert(suggestion));
    return trie;
  }

  /**
   * Indexes a suggestion under every token of its searchable text, so a walk
   * from the root along "b-i-n" reaches every suggestion containing a word that
   * starts with "bin" — including ones whose sentence begins with "Explain".
   * Indexing whole keys instead was why mid-sentence words never matched.
   */
  insert(suggestion: AutocompleteSuggestion) {
    const uniqueKey = `${suggestion.type}:${normalize(suggestion.value)}`;
    if (this.seen.has(uniqueKey)) return;

    const tokens = [...new Set(tokenize(getSearchableText(suggestion)))];
    if (!tokens.length) return;
    this.seen.add(uniqueKey);

    tokens.forEach((token) => {
      let node = this.root;
      for (const char of token) {
        const next = node.children.get(char) ?? createNode();
        node.children.set(char, next);
        node = next;
      }
      node.suggestions.push(suggestion);
    });
  }

  /**
   * Walks the trie once per query token and ranks only the collected
   * candidates. Because every suggestion is indexed under each of its tokens,
   * the union of the walks contains every possible match: a candidate the walk
   * misses cannot contain that token, and `scoreSuggestion` would reject it
   * anyway. No full-corpus scan runs per keystroke.
   */
  search(prefix: string, limit = 6) {
    const key = normalize(prefix);
    const queryTokens = tokenize(key);
    if (!key || !queryTokens.length) return [];

    // Beyond `limit` per token, ranking decides what is shown; the bound keeps
    // the candidate map from growing with the corpus.
    const candidates = new Map<string, AutocompleteSuggestion>();
    const collectLimit = limit * 4;
    queryTokens.forEach((token) => {
      let node = this.root;
      for (const char of token) {
        const next = node.children.get(char);
        if (!next) return;
        node = next;
      }
      this.collect(node, candidates, collectLimit);
    });

    return [...candidates.values()]
      .map((suggestion) => ({ suggestion, score: scoreSuggestion(suggestion, key) }))
      .filter((result) => Number.isFinite(result.score))
      .sort((a, b) => b.score - a.score || compareSuggestions(a.suggestion, b.suggestion))
      .slice(0, limit)
      .map((result) => result.suggestion);
  }

  private collect(node: TrieNode, results: Map<string, AutocompleteSuggestion>, limit: number) {
    if (results.size >= limit) return;

    node.suggestions.forEach((suggestion) => results.set(suggestion.id, suggestion));
    if (results.size >= limit) return;

    for (const child of node.children.values()) {
      this.collect(child, results, limit);
      if (results.size >= limit) return;
    }
  }
}
