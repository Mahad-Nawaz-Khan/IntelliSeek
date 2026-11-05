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

function isFuzzyTokenMatch(token: string, text: string): boolean {
  if (text.includes(token)) return true;
  if (token.length < 4) return false;
  const words = tokenize(text);
  for (const word of words) {
    if (word.startsWith(token)) return true;
    // Check prefixes of word around token.length (+/- 1 character)
    const minLen = Math.max(3, token.length - 1);
    const maxLen = Math.min(word.length, token.length + 1);
    for (let len = minLen; len <= maxLen; len++) {
      const prefix = word.slice(0, len);
      if (levenshteinDistanceAtMostOne(token, prefix)) {
        return true;
      }
    }
  }
  return false;
}

function levenshteinDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;

  let diffCount = 0;
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      diffCount++;
      if (diffCount > 1) return false;
      if (a.length > b.length) {
        i++;
      } else if (b.length > a.length) {
        j++;
      } else {
        i++;
        j++;
      }
    } else {
      i++;
      j++;
    }
  }
  return true;
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

  const missingToken = queryTokens.some(
    (token) => !searchable.includes(token) && !isFuzzyTokenMatch(token, searchable),
  );
  if (missingToken) return Number.NEGATIVE_INFINITY;

  const hasFuzzyOnlyToken = queryTokens.some(
    (token) => !searchable.includes(token) && isFuzzyTokenMatch(token, searchable),
  );
  if (hasFuzzyOnlyToken) {
    score -= 20; // Penalty for fuzzy matches so exact matches rank higher
  }

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
  private readonly root = createNode();
  private readonly seen = new Set<string>();

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
   * the union of the walks contains every possible match.
   * If exact matching yields fewer candidates than `limit`, a bounded fuzzy
   * walk (edit distance 1) recovers typo matches.
   */
  search(prefix: string, limit = 6) {
    const key = normalize(prefix);
    const queryTokens = tokenize(key);
    if (!key || !queryTokens.length) return [];

    const candidates = new Map<string, AutocompleteSuggestion>();
    const collectLimit = limit * 4;

    // Phase 1: Exact prefix walk per query token
    queryTokens.forEach((token) => {
      let node = this.root;
      for (const char of token) {
        const next = node.children.get(char);
        if (!next) return;
        node = next;
      }
      this.collect(node, candidates, collectLimit);
    });

    // Phase 2: If exact matching found too few results, try bounded fuzzy walk (1 edit distance)
    if (candidates.size < limit && queryTokens.some((t) => t.length >= 4)) {
      queryTokens.forEach((token) => {
        if (token.length >= 4) {
          this.fuzzyWalk(this.root, token, 0, 1, candidates, collectLimit);
        }
      });
    }

    return [...candidates.values()]
      .map((suggestion) => ({ suggestion, score: scoreSuggestion(suggestion, key) }))
      .filter((result) => Number.isFinite(result.score))
      .sort((a, b) => b.score - a.score || compareSuggestions(a.suggestion, b.suggestion))
      .slice(0, limit)
      .map((result) => result.suggestion);
  }

  /**
   * Walks the trie allowing up to `editsRemaining` character mismatches.
   * Prunes search branches whenever the edit budget is exhausted.
   */
  private fuzzyWalk(
    node: TrieNode,
    token: string,
    charIndex: number,
    editsRemaining: number,
    candidates: Map<string, AutocompleteSuggestion>,
    limit: number,
  ): void {
    if (candidates.size >= limit) return;

    if (charIndex >= token.length) {
      this.collect(node, candidates, limit);
      return;
    }

    const targetChar = token[charIndex];

    // 1. Exact match (0 edits)
    const exactChild = node.children.get(targetChar);
    if (exactChild) {
      this.fuzzyWalk(exactChild, token, charIndex + 1, editsRemaining, candidates, limit);
    }

    if (editsRemaining > 0) {
      // 2. Substitution: try other children
      for (const [char, child] of node.children) {
        if (char !== targetChar) {
          this.fuzzyWalk(child, token, charIndex + 1, editsRemaining - 1, candidates, limit);
        }
      }
      // 3. Deletion: skip current token character
      this.fuzzyWalk(node, token, charIndex + 1, editsRemaining - 1, candidates, limit);

      // 4. Insertion: advance in trie without consuming token character
      for (const [, child] of node.children) {
        this.fuzzyWalk(child, token, charIndex, editsRemaining - 1, candidates, limit);
      }
    }
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
