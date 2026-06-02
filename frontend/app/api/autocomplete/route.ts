import { SUGGESTIONS } from "../../../components/SuggestedQueries";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "../../../lib/server/rate-limit";
import { extractTopicsFromChunks } from "../../../lib/server/rag/topics";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";
import type { AutocompleteSuggestionMetadata, AutocompleteSuggestionType } from "../../../lib/trie-autocomplete";

export const runtime = "nodejs";

type Suggestion = {
  id: string;
  label: string;
  value: string;
  type: AutocompleteSuggestionType;
  keywords?: string[];
  metadata?: AutocompleteSuggestionMetadata;
};

type DocumentRow = {
  id: string;
  filename: string;
  source_scope?: "personal" | "knowledge_base";
};

type TopicRow = {
  id: string;
  topic: string;
  documents: Array<{
    id: string;
    filename: string;
    source_scope?: string | null;
  }> | {
    id: string;
    filename: string;
    source_scope?: string | null;
  } | null;
};

type ChunkRow = {
  id: string;
  document_id: string;
  text_content: string;
  chunk_index: number;
  documents: Array<{
    id: string;
    filename: string;
    source_scope?: string | null;
  }> | {
    id: string;
    filename: string;
    source_scope?: string | null;
  } | null;
};

function applyAccessibleDocumentFilter<T>(query: T, userId: string): T {
  return (query as { or: (filters: string, options?: { foreignTable?: string }) => T })
    .or(`user_id.eq.${userId},source_scope.eq.knowledge_base`, { foreignTable: "documents" });
}

type HistoryRow = {
  id: string;
  question: string;
};

function toAutocompleteId(input: string) {
  return input.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const BLOCKED_TOPIC_WORDS = new Set([
  "also",
  "and",
  "are",
  "but",
  "can",
  "for",
  "from",
  "how",
  "not",
  "only",
  "the",
  "this",
  "use",
  "used",
  "was",
  "what",
  "when",
  "where",
  "which",
  "with",
  "you",
]);

const GENERIC_COMMAND_TOPICS = new Set([
  "answer",
  "answered",
  "answers",
  "ask",
  "asked",
  "define",
  "describe",
  "discuss",
  "explain",
  "explained",
  "explaining",
  "explains",
  "give",
  "question",
  "questions",
  "summarize",
  "summary",
]);

const TOPIC_TEMPLATES = [
  "Explain {topic}",
  "What is {topic}?",
  "Summarize {topic} from my uploaded documents",
  "Give me key points about {topic}",
];

function normalizeTopicForSuggestion(topic: string) {
  const normalized = topic.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);

  while (words.length > 1 && GENERIC_COMMAND_TOPICS.has(words[0])) {
    words.shift();
  }

  if (!words.length) return null;
  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isUsefulTopic(topic: string) {
  const normalized = topic.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  if (!words.length || words.some((word) => BLOCKED_TOPIC_WORDS.has(word))) return false;
  if (words.length === 1 && GENERIC_COMMAND_TOPICS.has(words[0])) return false;
  if (words.length === 1 && words[0].length < 4) return false;
  return words.some((word) => /[a-z]/.test(word) && word.length >= 4);
}

function topicToSuggestions(topic: string) {
  const normalizedTopic = topic.replace(/\s+/g, " ").trim();
  if (!normalizedTopic) return [];

  return TOPIC_TEMPLATES.map((template) => template.replace("{topic}", normalizedTopic));
}

function pushUnique(suggestions: Suggestion[], seen: Set<string>, suggestion: Suggestion) {
  const key = `${suggestion.type}:${suggestion.value.toLocaleLowerCase().replace(/\s+/g, " ").trim()}`;
  if (seen.has(key)) return;
  seen.add(key);
  suggestions.push(suggestion);
}

function getJoinedDocument(row: ChunkRow) {
  if (Array.isArray(row.documents)) return row.documents[0] ?? null;
  return row.documents;
}

function getTopicDocuments(row: TopicRow) {
  if (Array.isArray(row.documents)) return row.documents;
  return row.documents ? [row.documents] : [];
}

async function getFallbackTopicRows(
  supabase: NonNullable<ReturnType<typeof getSupabaseServiceClient>>,
  documents: DocumentRow[],
): Promise<TopicRow[]> {
  if (!documents.length) return [];

  const { data, error } = await supabase
    .from("chunks")
    .select("id, document_id, text_content, chunk_index, documents!inner(id, filename)")
    .in("document_id", documents.map((document) => document.id))
    .order("chunk_index", { ascending: true })
    .limit(40);

  if (error) return [];

  const chunksByDocument = new Map<string, { filename: string; chunks: string[] }>();
  ((data ?? []) as ChunkRow[]).forEach((chunk) => {
    const document = getJoinedDocument(chunk);
    if (!document) return;

    const current = chunksByDocument.get(chunk.document_id) ?? {
      filename: document.filename,
      chunks: [],
    };
    current.chunks.push(chunk.text_content);
    chunksByDocument.set(chunk.document_id, current);
  });

  return [...chunksByDocument.entries()].flatMap(([documentId, document]) =>
    extractTopicsFromChunks(document.chunks, document.filename, { limit: 6 }).map((topic, index) => ({
      id: `fallback-${documentId}-${index}`,
      topic: topic.topic,
      documents: {
        id: documentId,
        filename: document.filename,
      },
    })),
  );
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  const rateLimit = await checkRateLimit({
    key: `autocomplete:${user.id}:${getClientIp(request)}`,
    limit: 120,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit);

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Supabase service client is not configured" }, { status: 500 });
  }

  const documentsQuery = supabase
      .from("documents")
      .select("id, filename, source_scope")
      .or(`user_id.eq.${user.id},source_scope.eq.knowledge_base`)
      .eq("processing_status", "indexed")
      .order("created_at", { ascending: false })
      .limit(8);
  const topicsQuery = applyAccessibleDocumentFilter(
    supabase
      .from("document_topics")
      .select("id, topic, documents!inner(id, filename, user_id, source_scope)")
      .order("score", { ascending: false })
      .limit(20),
    user.id,
  );

  const [documentsResult, topicsResult, historyResult] = await Promise.all([
    documentsQuery,
    topicsQuery,
    supabase
      .from("chat_history")
      .select("id, question")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (documentsResult.error || topicsResult.error || historyResult.error) {
    return Response.json({ ok: false, error: "Autocomplete lookup failed" }, { status: 500 });
  }

  const documents = (documentsResult.data ?? []) as DocumentRow[];
  const storedTopicRows = (topicsResult.data ?? []) as TopicRow[];
  const topicRows = storedTopicRows.length
    ? storedTopicRows
    : await getFallbackTopicRows(supabase, documents);
  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();

  topicRows.forEach((row) => {
    const topic = normalizeTopicForSuggestion(row.topic);
    if (!topic || !isUsefulTopic(topic)) return;

    const topicDocuments = getTopicDocuments(row);
    const documentIds = topicDocuments.map((document) => document.id);
    const metadata: AutocompleteSuggestionMetadata | undefined = documentIds.length
      ? {
          source: "uploaded",
          kind: "topic",
          topic: row.topic,
          topicId: row.id.startsWith("fallback-") ? undefined : row.id,
          documentIds,
        }
      : undefined;

    topicToSuggestions(topic).forEach((value) => {
      pushUnique(suggestions, seen, {
        id: `topic-${row.id}-${toAutocompleteId(value)}`,
        label: value,
        value,
        type: "topic",
        keywords: [topic, row.topic],
        metadata,
      });
    });
  });

  documents.forEach((document) => {
    [
      `Summarize ${document.filename}`,
      `What topics are covered in ${document.filename}?`,
      `Explain key concepts from ${document.filename}`,
    ].forEach((value) => {
      pushUnique(suggestions, seen, {
        id: `document-${document.id}-${toAutocompleteId(value)}`,
        label: value,
        value,
        type: "document",
        metadata: {
          source: "uploaded",
          kind: "document",
          documentId: document.id,
        },
      });
    });
  });

  ((historyResult.data ?? []) as HistoryRow[]).forEach((row) => {
    pushUnique(suggestions, seen, {
      id: `history-${row.id}`,
      label: row.question,
      value: row.question,
      type: "history",
    });
  });

  SUGGESTIONS.forEach((prompt) => {
    pushUnique(suggestions, seen, {
      id: `prompt-${toAutocompleteId(prompt)}`,
      label: prompt,
      value: prompt,
      type: "prompt",
    });
  });

  return Response.json(
    { ok: true, suggestions: suggestions.slice(0, 120) },
    { headers: rateLimitHeaders(rateLimit) },
  );
}
