import { SUGGESTIONS } from "../../../components/SuggestedQueries";
import { getAuthenticatedUser } from "../../../lib/server/auth";
import { getSupabaseServiceClient } from "../../../lib/server/supabase";
import type { AutocompleteSuggestionType } from "../../../lib/trie-autocomplete";

export const runtime = "nodejs";

type Suggestion = {
  id: string;
  label: string;
  value: string;
  type: AutocompleteSuggestionType;
  keywords?: string[];
};

type DocumentRow = {
  id: string;
  filename: string;
};

type TopicRow = {
  id: string;
  topic: string;
  documents: Array<{
    id: string;
    filename: string;
  }> | {
    id: string;
    filename: string;
  } | null;
};

type HistoryRow = {
  id: string;
  question: string;
};

function toAutocompleteId(input: string) {
  return input.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const BLOCKED_TOPICS = new Set([
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

function isUsefulTopic(topic: string) {
  const normalized = topic.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  const words = normalized.split(" ").filter(Boolean);
  if (!words.length || words.some((word) => BLOCKED_TOPICS.has(word))) return false;
  if (words.length === 1 && words[0].length < 4) return false;
  return words.some((word) => /[a-z]/.test(word) && word.length >= 4);
}

function pushUnique(suggestions: Suggestion[], seen: Set<string>, suggestion: Suggestion) {
  const key = `${suggestion.type}:${suggestion.value.toLocaleLowerCase().replace(/\s+/g, " ").trim()}`;
  if (seen.has(key)) return;
  seen.add(key);
  suggestions.push(suggestion);
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    return Response.json({ ok: false, error: "Supabase service client is not configured" }, { status: 500 });
  }

  const [documentsResult, topicsResult, historyResult] = await Promise.all([
    supabase
      .from("documents")
      .select("id, filename")
      .eq("user_id", user.id)
      .eq("processing_status", "indexed")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("document_topics")
      .select("id, topic, documents!inner(id, filename)")
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(20),
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

  const suggestions: Suggestion[] = [];
  const seen = new Set<string>();

  SUGGESTIONS.forEach((prompt) => {
    pushUnique(suggestions, seen, {
      id: `prompt-${toAutocompleteId(prompt)}`,
      label: prompt,
      value: prompt,
      type: "prompt",
    });
  });

  ((documentsResult.data ?? []) as DocumentRow[]).forEach((document) => {
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
      });
    });
  });

  ((topicsResult.data ?? []) as TopicRow[]).forEach((row) => {
    if (!isUsefulTopic(row.topic)) return;

    const value = row.topic;
    pushUnique(suggestions, seen, {
      id: `topic-${row.id}-${toAutocompleteId(value)}`,
      label: value,
      value,
      type: "topic",
      keywords: [row.topic],
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

  return Response.json({ ok: true, suggestions: suggestions.slice(0, 80) });
}
