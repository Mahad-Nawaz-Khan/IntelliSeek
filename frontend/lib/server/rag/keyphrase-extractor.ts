/**
 * Extracts key phrases from chunk text using multiple heuristics:
 * 1. Definition patterns ("X is defined as", "X refers to", "X:")
 * 2. Capitalized technical phrases / named entities ("Binary Search Tree")
 * 3. Technical acronyms ("ACID", "REST", "FIFO")
 * 4. High-frequency domain terms (TF-based, filtered against common stop words)
 */

const DEFINITION_PATTERNS = [
  /(?:^|\.\s+)([A-Z][a-z]+(?:\s+[A-Za-z]+){0,4})\s+(?:is|are|was|were|refers?\s+to|means?|denotes?)\s/gm,
  /(?:^|\.\s+)(?:The\s+)?([A-Z][a-z]+(?:\s+[A-Za-z]+){0,3})\s*(?::|—|–)\s/gm,
];

const ACRONYM_PATTERN = /\b([A-Z]{2,6})\b/g;

const CAPITALIZED_PHRASE_PATTERN = /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,4})\b/g;

const KEYPHRASE_STOP = new Set([
  "about",
  "after",
  "again",
  "also",
  "another",
  "because",
  "before",
  "between",
  "chapter",
  "during",
  "each",
  "every",
  "example",
  "figure",
  "first",
  "following",
  "from",
  "into",
  "more",
  "most",
  "other",
  "page",
  "section",
  "should",
  "since",
  "some",
  "such",
  "table",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "this",
  "those",
  "through",
  "under",
  "using",
  "where",
  "which",
  "while",
  "with",
]);

export type ExtractedKeyphrase = {
  phrase: string;
  score: number;
  source: "definition" | "capitalized" | "acronym" | "frequency";
};

export function extractKeyphrases(
  chunks: string[],
  options: { limit?: number } = {},
): ExtractedKeyphrase[] {
  const limit = options.limit ?? 60;
  const phraseScores = new Map<string, { score: number; source: ExtractedKeyphrase["source"] }>();

  function addPhrase(phrase: string, score: number, source: ExtractedKeyphrase["source"]) {
    const normalized = phrase.trim().replace(/\s+/g, " ");
    if (normalized.length < 3 || normalized.length > 80) return;

    const words = normalized.toLowerCase().split(" ");
    if (words.every((w) => KEYPHRASE_STOP.has(w))) return;
    if (words.length === 1 && words[0].length < 3) return;

    const key = normalized.toLowerCase();
    const existing = phraseScores.get(key);
    if (!existing || existing.score < score) {
      phraseScores.set(key, { score, source });
    }
  }

  const fullText = chunks.join("\n\n");

  // Strategy 1: Definition patterns (highest priority)
  for (const pattern of DEFINITION_PATTERNS) {
    for (const match of fullText.matchAll(pattern)) {
      if (match[1]) addPhrase(match[1], 10, "definition");
    }
  }

  // Strategy 2: Capitalized multi-word technical phrases
  for (const match of fullText.matchAll(CAPITALIZED_PHRASE_PATTERN)) {
    if (match[1]) addPhrase(match[1], 6, "capitalized");
  }

  // Strategy 3: Technical acronyms
  for (const match of fullText.matchAll(ACRONYM_PATTERN)) {
    if (match[1] && match[1].length >= 2 && !KEYPHRASE_STOP.has(match[1].toLowerCase())) {
      addPhrase(match[1], 4, "acronym");
    }
  }

  // Strategy 4: High-frequency domain terms
  const termFreq = new Map<string, number>();
  for (const chunk of chunks) {
    const words = chunk
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !KEYPHRASE_STOP.has(w));
    for (const word of words) {
      termFreq.set(word, (termFreq.get(word) ?? 0) + 1);
    }
  }

  const sortedTerms = [...termFreq.entries()]
    .filter(([, freq]) => freq >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40);

  for (const [term, freq] of sortedTerms) {
    addPhrase(term, Math.min(freq, 8), "frequency");
  }

  return [...phraseScores.entries()]
    .map(([phrase, { score, source }]) => ({
      phrase: phrase
        .split(" ")
        .map((w) => (w.length <= 4 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" "),
      score,
      source,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

