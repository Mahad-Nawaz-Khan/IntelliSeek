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
  "about",
  "above",
  "after",
  "again",
  "against",
  "also",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "cannot",
  "chapter",
  "could",
  "does",
  "doing",
  "during",
  "each",
  "example",
  "from",
  "further",
  "have",
  "having",
  "here",
  "into",
  "more",
  "most",
  "other",
  "same",
  "section",
  "should",
  "shown",
  "such",
  "than",
  "that",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "using",
  "very",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
]);

function tokenize(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^-+|-+$/g, ""))
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token) && !STOP_WORDS.has(token));
}

function toLabel(topic: string) {
  return topic
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .slice(0, 80)
    .trim();
}

function addTopic(topics: Map<string, TopicStats>, topic: string, sourceChunkIndex: number, filenameTokens: Set<string>) {
  if (topic.length > 80) return;

  const tokens = topic.split(" ");
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
    const tokens = tokenize(chunk);
    tokens.forEach((token) => addTopic(topics, token, chunkIndex, filenameTokens));

    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= tokens.length - size; index += 1) {
        const phrase = tokens.slice(index, index + size).join(" ");
        addTopic(topics, phrase, chunkIndex, filenameTokens);
      }
    }
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
