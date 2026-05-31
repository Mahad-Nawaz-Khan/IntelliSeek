export type ExtractedTopic = {
  topic: string;
  frequency: number;
  score: number;
  sourceChunkIndex?: number;
};

type TopicStats = {
  frequency: number;
  sourceChunkIndex: number;
  tokenCount: number;
  filenameBoost: number;
};

const STOP_WORDS = new Set([
  "also",
  "although",
  "and",
  "answer",
  "answered",
  "answers",
  "are",
  "ask",
  "asked",
  "because",
  "been",
  "but",
  "can",
  "cannot",
  "chapter",
  "could",
  "define",
  "describe",
  "did",
  "discuss",
  "does",
  "doing",
  "done",
  "during",
  "each",
  "example",
  "explain",
  "explained",
  "explaining",
  "explains",
  "for",
  "from",
  "give",
  "had",
  "has",
  "have",
  "having",
  "here",
  "how",
  "into",
  "may",
  "more",
  "most",
  "not",
  "off",
  "one",
  "only",
  "other",
  "our",
  "out",
  "question",
  "questions",
  "same",
  "section",
  "should",
  "show",
  "shown",
  "such",
  "summarize",
  "summary",
  "than",
  "that",
  "the",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "too",
  "under",
  "use",
  "used",
  "using",
  "very",
  "was",
  "way",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "why",
  "will",
  "with",
  "would",
  "you",
]);

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !STOP_WORDS.has(token));
}

function normalizeWord(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

function splitSentences(input: string) {
  return input
    .replace(/\s+/g, " ")
    .split(/[.!?;:\n]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractCandidatePhrases(input: string) {
  const candidates: string[] = [];

  splitSentences(input).forEach((sentence) => {
    const words = sentence
      .split(/\s+/)
      .map(normalizeWord)
      .filter((word) => word.length >= 3 && !/^\d+$/.test(word));

    let phrase: string[] = [];

    const flushPhrase = () => {
      if (!phrase.length) return;

      if (phrase.length === 1) {
        candidates.push(phrase[0]);
      } else {
        for (let size = Math.min(4, phrase.length); size >= 2; size -= 1) {
          for (let index = 0; index <= phrase.length - size; index += 1) {
            candidates.push(phrase.slice(index, index + size).join(" "));
          }
        }
      }

      phrase = [];
    };

    words.forEach((word) => {
      if (STOP_WORDS.has(word)) {
        flushPhrase();
        return;
      }

      phrase.push(word);
    });

    flushPhrase();
  });

  return candidates;
}

function toLabel(topic: string) {
  return topic
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 80)
    .trim();
}

function isUsefulTopic(tokens: string[]) {
  if (!tokens.length || tokens.some((token) => STOP_WORDS.has(token))) return false;
  if (tokens.length === 1 && tokens[0].length < 4) return false;
  return tokens.some((token) => /[a-z]/.test(token) && token.length >= 4);
}

function addTopic(topics: Map<string, TopicStats>, topic: string, sourceChunkIndex: number, filenameTokens: Set<string>) {
  if (topic.length > 80) return;

  const tokens = topic.split(" ");
  if (!isUsefulTopic(tokens)) return;

  const filenameBoost = tokens.some((token) => filenameTokens.has(token)) ? 1.25 : 1;
  const current = topics.get(topic);

  if (current) {
    current.frequency += 1;
    current.filenameBoost = Math.max(current.filenameBoost, filenameBoost);
    return;
  }

  topics.set(topic, {
    frequency: 1,
    sourceChunkIndex,
    tokenCount: tokens.length,
    filenameBoost,
  });
}

export function extractTopicsFromChunks(
  chunks: string[],
  filename: string,
  options: { limit?: number } = {},
): ExtractedTopic[] {
  const limit = Math.max(1, Math.min(options.limit ?? 12, 24));
  const filenameTokens = new Set(tokenize(filename.replace(/\.[^.]+$/, "")));
  const topics = new Map<string, TopicStats>();

  chunks.forEach((chunk, chunkIndex) => {
    extractCandidatePhrases(chunk).forEach((phrase) => addTopic(topics, phrase, chunkIndex, filenameTokens));
  });

  return [...topics.entries()]
    .map(([topic, stats]) => ({
      topic: toLabel(topic),
      frequency: stats.frequency,
      score: Number((stats.frequency * stats.tokenCount * stats.filenameBoost).toFixed(2)),
      sourceChunkIndex: stats.sourceChunkIndex,
    }))
    .filter((topic) => topic.score >= 2 || topic.frequency >= 2)
    .sort((a, b) => b.score - a.score || b.frequency - a.frequency || a.topic.localeCompare(b.topic))
    .slice(0, limit);
}
