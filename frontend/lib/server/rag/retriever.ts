import type { SourceCitation } from "../../chat-api";
import type { RequestLogger } from "../logger";
import { embedText } from "./embeddings";
import { matchUserChunks, type RetrievedChunk } from "./vector-store";
import { getSupabaseServiceClient } from "../supabase";

const DEFAULT_TOP_K = 10;
const SEMANTIC_CANDIDATE_LIMIT = 20;
const MAX_CONTEXT_CHUNKS = 12;
const NEIGHBOR_WINDOW = 1;
const MAX_QUESTION_LENGTH = 1000;
export const FILE_CONTEXT_MIN_SCORE = 0.55;
export const FILE_CONTEXT_WEAK_SCORE = 0.45;

export type RetrievedContext = RetrievedChunk;

type RepresentativeChunkRow = {
  id: string;
  document_id: string;
  text_content: string;
  chunk_index: number;
  documents: Array<{
    filename: string | null;
    source_scope?: string | null;
  }> | {
    filename: string | null;
    source_scope?: string | null;
  } | null;
};

type IndexedDocumentRow = {
  id: string;
  filename: string;
  source_scope?: "personal" | "knowledge_base";
};

type DocumentChunkRow = {
  id: string;
  document_id: string;
  text_content: string;
  chunk_index: number;
  documents: Array<{
    filename: string | null;
    source_scope?: string | null;
  }> | {
    filename: string | null;
    source_scope?: string | null;
  } | null;
};

type NeighborChunkRow = DocumentChunkRow;

function applyAccessibleDocumentFilter<T>(query: T, userId: string): T {
  return (query as { or: (filters: string, options?: { foreignTable?: string }) => T })
    .or(`user_id.eq.${userId},source_scope.eq.knowledge_base`, { foreignTable: "documents" });
}

const SUMMARY_INTENT_PATTERN = /\b(summarize|summerize|summarise|summary|summery|overview|outline|key points|main points|topics covered)\b/i;
const DOCUMENT_REFERENCE_PATTERNS = [
  /\b(my|uploaded|all|these|the)?\s*(notes|documents|files|file|material|uploads)\b/i,
  /\b(uploaded|document|file)\s+(notes|summary|overview|outline|topics)\b/i,
  /\bwhat\s+(is|are)\s+(in|inside|covered)\b/i,
];

const FILENAME_STOP_WORDS = new Set([
  "all",
  "from",
  "give",
  "key",
  "main",
  "material",
  "notes",
  "overview",
  "please",
  "points",
  "summarise",
  "summarize",
  "summerize",
  "summery",
  "summary",
  "the",
  "topics",
  "uploaded",
  "what",
]);

const CONTENT_STOP_WORDS = new Set([
  ...FILENAME_STOP_WORDS,
  "about",
  "answer",
  "chapter",
  "concept",
  "define",
  "describe",
  "does",
  "explain",
  "find",
  "give",
  "have",
  "into",
  "tell",
  "this",
  "with",
]);

function tokenizeSearchText(input: string) {
  return input
    .toLocaleLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !FILENAME_STOP_WORDS.has(token));
}

function tokenizeContentQuery(input: string) {
  return input
    .toLocaleLowerCase()
    .replace(/[`*_#[\]()>]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !CONTENT_STOP_WORDS.has(token));
}

function extractKeywordTerms(question: string) {
  const quoted = [...question.matchAll(/["']([^"']{3,80})["']/g)].map((match) => match[1]);
  const tokens = [...new Set(tokenizeContentQuery(question))]
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);
  const compactQuestion = question.replace(/\s+/g, " ").trim();
  const phrases = compactQuestion.length >= 3 && compactQuestion.length <= 80 ? [compactQuestion] : [];

  return [...new Set([...quoted, ...phrases, ...tokens])]
    .map((term) => term.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim())
    .filter((term) => term.length >= 3)
    .slice(0, 10);
}

function getJoinedChunkDocument(row: DocumentChunkRow | NeighborChunkRow | RepresentativeChunkRow) {
  if (Array.isArray(row.documents)) return row.documents[0] ?? null;
  return row.documents;
}

function rowToContext(chunk: DocumentChunkRow | NeighborChunkRow | RepresentativeChunkRow, score: number): RetrievedContext {
  return {
    chunk_id: chunk.id,
    document_id: chunk.document_id,
    filename: getJoinedChunkDocument(chunk)?.filename ?? "Uploaded document",
    text_content: chunk.text_content,
    chunk_index: chunk.chunk_index,
    score,
  };
}

function dedupeContext(context: RetrievedContext[]) {
  const seen = new Set<string>();
  const deduped: RetrievedContext[] = [];

  for (const chunk of context) {
    const key = `${chunk.document_id}:${chunk.chunk_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(chunk);
  }

  return deduped;
}

export function mergeRetrievedContext(...groups: RetrievedContext[][]): RetrievedContext[] {
  return dedupeContext(groups.flat())
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_CHUNKS);
}

function scoreFilenameMatch(question: string, filename: string) {
  const questionTokens = new Set(tokenizeSearchText(question));
  const filenameTokens = tokenizeSearchText(filename);
  if (!questionTokens.size || !filenameTokens.length) return 0;

  return filenameTokens.reduce(
    (score, token) => score + (questionTokens.has(token) ? 1 : 0),
    0,
  );
}

export function validateQuestion(question: string): string {
  const trimmed = question.trim();
  if (!trimmed) throw new Error("Question is required");
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    throw new Error(`Question is too long. Maximum is ${MAX_QUESTION_LENGTH} characters.`);
  }
  return trimmed;
}

export async function retrieveContext(
  question: string,
  userId: string,
  limit = DEFAULT_TOP_K,
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  const startedAt = Date.now();
  const candidateLimit = Math.min(Math.max(limit * 3, SEMANTIC_CANDIDATE_LIMIT), SEMANTIC_CANDIDATE_LIMIT);
  log?.info("retrieval.semantic.start", { userId, limit, candidateLimit, questionLength: question.length });
  const queryEmbedding = await embedText(question, log);
  const candidates = await matchUserChunks(userId, queryEmbedding, candidateLimit, log);
  const context = await expandContextWithNeighbors(userId, candidates.slice(0, limit), Math.min(limit + 4, MAX_CONTEXT_CHUNKS), log);
  log?.info("retrieval.semantic.complete", {
    userId,
    limit,
    candidateCount: candidates.length,
    resultCount: context.length,
    durationMs: Date.now() - startedAt,
  });
  return context;
}

export async function retrieveKeywordContext(
  question: string,
  userId: string,
  limit = DEFAULT_TOP_K,
  log?: RequestLogger,
  documentIds: string[] = [],
): Promise<RetrievedContext[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    log?.error("retrieval.keyword.client_unavailable", { errorCategory: "supabase_query", userId });
    return [];
  }

  const terms = extractKeywordTerms(question);
  if (!terms.length) return [];

  const startedAt = Date.now();
  const uniqueDocumentIds = [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))].slice(0, 8);
  const orFilter = terms.map((term) => `text_content.ilike.%${term}%`).join(",");
  log?.info("retrieval.keyword.start", {
    userId,
    limit,
    termCount: terms.length,
    documentCount: uniqueDocumentIds.length,
  });

  let query = supabase
    .from("chunks")
    .select("id, document_id, text_content, chunk_index, documents!inner(filename, user_id, source_scope, processing_status)")
    .eq("documents.processing_status", "indexed")
    .or(orFilter)
    .order("chunk_index", { ascending: true })
    .limit(Math.min(Math.max(limit * 2, 8), 20));

  query = applyAccessibleDocumentFilter(query, userId);

  if (uniqueDocumentIds.length) query = query.in("document_id", uniqueDocumentIds);

  const { data, error } = await query;
  if (error) {
    log?.warn("retrieval.keyword.failed", { errorCategory: "supabase_query", userId, error });
    return [];
  }

  const scored = ((data ?? []) as DocumentChunkRow[])
    .map((chunk) => {
      const lowerText = chunk.text_content.toLocaleLowerCase();
      const matchCount = terms.reduce((count, term) => count + (lowerText.includes(term.toLocaleLowerCase()) ? 1 : 0), 0);
      return rowToContext(chunk, Math.min(0.9, 0.62 + matchCount * 0.06));
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const context = await expandContextWithNeighbors(userId, scored, Math.min(limit + 4, MAX_CONTEXT_CHUNKS), log);
  log?.info("retrieval.keyword.complete", {
    userId,
    limit,
    resultCount: context.length,
    durationMs: Date.now() - startedAt,
  });

  return context;
}

export async function expandContextWithNeighbors(
  userId: string,
  context: RetrievedContext[],
  limit = MAX_CONTEXT_CHUNKS,
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  const supabase = getSupabaseServiceClient();
  const seeds = dedupeContext(context).slice(0, limit);
  if (!supabase || !seeds.length) return seeds;

  const neighborLookups = new Map<string, Set<number>>();
  seeds.forEach((chunk) => {
    const indexes = neighborLookups.get(chunk.document_id) ?? new Set<number>();
    for (let offset = -NEIGHBOR_WINDOW; offset <= NEIGHBOR_WINDOW; offset += 1) {
      const index = chunk.chunk_index + offset;
      if (index >= 0) indexes.add(index);
    }
    neighborLookups.set(chunk.document_id, indexes);
  });

  const rows = (await Promise.all([...neighborLookups.entries()].map(async ([documentId, indexes]) => {
    const query = supabase
      .from("chunks")
      .select("id, document_id, text_content, chunk_index, documents!inner(filename, user_id, source_scope)")
      .eq("document_id", documentId)
      .in("chunk_index", [...indexes])
      .order("chunk_index", { ascending: true });

    const { data, error } = await applyAccessibleDocumentFilter(query, userId);

    if (error) {
      log?.warn("retrieval.neighbors.failed", { errorCategory: "supabase_query", userId, documentId, error });
      return [] as NeighborChunkRow[];
    }

    return (data ?? []) as NeighborChunkRow[];
  }))).flat();

  const seedScoreByKey = new Map(seeds.map((chunk) => [`${chunk.document_id}:${chunk.chunk_index}`, chunk.score]));
  const byKey = new Map<string, RetrievedContext>();
  rows.forEach((row) => {
    const seedScore = seedScoreByKey.get(`${row.document_id}:${row.chunk_index}`);
    const nearestSeed = seeds
      .filter((chunk) => chunk.document_id === row.document_id)
      .sort((a, b) => Math.abs(a.chunk_index - row.chunk_index) - Math.abs(b.chunk_index - row.chunk_index))[0];
    const score = seedScore ?? Math.max(0.5, (nearestSeed?.score ?? 0.55) - 0.04);
    byKey.set(`${row.document_id}:${row.id}`, rowToContext(row, score));
  });

  seeds.forEach((chunk) => byKey.set(`${chunk.document_id}:${chunk.chunk_id}`, chunk));

  const expanded: RetrievedContext[] = [];
  for (const seed of seeds) {
    const related = [...byKey.values()]
      .filter((chunk) => chunk.document_id === seed.document_id && Math.abs(chunk.chunk_index - seed.chunk_index) <= NEIGHBOR_WINDOW)
      .sort((a, b) => a.chunk_index - b.chunk_index);
    expanded.push(...related);
  }

  return dedupeContext(expanded).slice(0, limit);
}

export async function retrieveContextFromDocumentIds(
  question: string,
  userId: string,
  documentIds: string[],
  limit = DEFAULT_TOP_K,
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  const uniqueDocumentIds = new Set(documentIds.map((id) => id.trim()).filter(Boolean));
  if (!uniqueDocumentIds.size) return [];

  const broadLimit = Math.min(Math.max(limit * 6, 20), 40);
  log?.info("retrieval.semantic_documents.start", {
    userId,
    documentCount: uniqueDocumentIds.size,
    limit,
    broadLimit,
    questionLength: question.length,
  });

  const semanticContext = await retrieveContext(question, userId, broadLimit, log);
  const keywordContext = await retrieveKeywordContext(question, userId, limit, log, [...uniqueDocumentIds]);
  const context = mergeRetrievedContext(semanticContext, keywordContext);
  const filtered = context
    .filter((chunk) => uniqueDocumentIds.has(chunk.document_id))
    .slice(0, limit);
  const relevant = filterRelevantContext(filtered, log);

  log?.info("retrieval.semantic_documents.complete", {
    userId,
    documentCount: uniqueDocumentIds.size,
    beforeCount: context.length,
    afterCount: relevant.length,
  });

  return relevant;
}

export async function retrieveDemoContext(
  question: string,
  limit = DEFAULT_TOP_K,
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  const dummyUserId = "00000000-0000-0000-0000-000000000000";
  return retrieveContext(question, dummyUserId, limit, log);
}

export async function retrieveDemoKeywordContext(
  question: string,
  limit = DEFAULT_TOP_K,
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  const dummyUserId = "00000000-0000-0000-0000-000000000000";
  return retrieveKeywordContext(question, dummyUserId, limit, log);
}

export async function retrieveDemoRepresentativeDocumentContext(
  limit = 10,
  question?: string,
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  const dummyUserId = "00000000-0000-0000-0000-000000000000";
  return retrieveRepresentativeDocumentContext(dummyUserId, limit, question, log);
}

export async function demoHasIndexedDocuments(log?: RequestLogger): Promise<boolean> {
  const dummyUserId = "00000000-0000-0000-0000-000000000000";
  return hasIndexedDocuments(dummyUserId, log);
}

export function isDocumentSummaryRequest(question: string) {
  const normalized = question.toLocaleLowerCase();
  return SUMMARY_INTENT_PATTERN.test(normalized);
}

export async function hasIndexedDocuments(userId: string, log?: RequestLogger) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    log?.error("retrieval.indexed_documents.client_unavailable", { errorCategory: "supabase_query", userId });
    return false;
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .or(`user_id.eq.${userId},source_scope.eq.knowledge_base`)
    .eq("processing_status", "indexed")
    .limit(1);

  if (error) {
    log?.error("retrieval.indexed_documents.failed", { errorCategory: "supabase_query", userId, error });
    return false;
  }

  const hasDocuments = Boolean(data?.length);
  log?.info("retrieval.indexed_documents.complete", { userId, hasDocuments });
  return hasDocuments;
}

export async function retrieveDocumentContextByIds(
  userId: string,
  documentIds: string[],
  limit = 10,
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    log?.error("retrieval.documents.client_unavailable", { errorCategory: "supabase_query", userId });
    return [];
  }

  const uniqueDocumentIds = [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))].slice(0, 4);
  if (!uniqueDocumentIds.length) {
    log?.warn("retrieval.documents.empty_ids", { errorCategory: "retrieval", userId, limit });
    return [];
  }

  const startedAt = Date.now();
  log?.info("retrieval.documents.start", { userId, documentCount: uniqueDocumentIds.length, limit });

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, filename, source_scope")
    .or(`user_id.eq.${userId},source_scope.eq.knowledge_base`)
    .eq("processing_status", "indexed")
    .in("id", uniqueDocumentIds);

  if (documentsError || !documents?.length) {
    log?.error("retrieval.documents.lookup_failed", {
      errorCategory: documentsError ? "supabase_query" : "retrieval",
      userId,
      documentCount: uniqueDocumentIds.length,
      error: documentsError,
    });
    return [];
  }

  const ownedDocumentIds = ((documents ?? []) as IndexedDocumentRow[]).map((document) => document.id);
  const { data, error } = await supabase
    .from("chunks")
    .select("id, document_id, text_content, chunk_index, documents!inner(filename, source_scope)")
    .in("document_id", ownedDocumentIds)
    .order("chunk_index", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error) {
    log?.error("retrieval.documents.chunks_failed", { errorCategory: "supabase_query", userId, limit, error });
    return [];
  }

  const context = ((data ?? []) as DocumentChunkRow[]).map((chunk) => rowToContext(chunk, 1));

  log?.info("retrieval.documents.complete", {
    userId,
    documentCount: ownedDocumentIds.length,
    resultCount: context.length,
    durationMs: Date.now() - startedAt,
  });

  return context;
}

export async function retrieveRepresentativeDocumentContext(
  userId: string,
  limit = 8,
  question = "",
  log?: RequestLogger,
): Promise<RetrievedContext[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    log?.error("retrieval.representative.client_unavailable", { errorCategory: "supabase_query", userId });
    return [];
  }

  const startedAt = Date.now();
  log?.info("retrieval.representative.start", { userId, limit, questionLength: question.length });

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, filename, source_scope")
    .or(`user_id.eq.${userId},source_scope.eq.knowledge_base`)
    .eq("processing_status", "indexed")
    .order("created_at", { ascending: false })
    .limit(12);

  if (documentsError || !documents?.length) {
    log?.error("retrieval.representative.documents_failed", {
      errorCategory: documentsError ? "supabase_query" : "retrieval",
      userId,
      error: documentsError,
    });
    return [];
  }

  const indexedDocuments = documents as IndexedDocumentRow[];
  const filenameMatches = question
    ? indexedDocuments
      .map((document) => ({ document, score: scoreFilenameMatch(question, document.filename) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((match) => match.document)
    : [];
  const hasExplicitDocumentReference = DOCUMENT_REFERENCE_PATTERNS.some((pattern) => pattern.test(question));
  const selectedDocuments = filenameMatches.length
    ? filenameMatches.slice(0, 4)
    : hasExplicitDocumentReference || isDocumentSummaryRequest(question)
      ? indexedDocuments.slice(0, 4)
      : [];

  if (!selectedDocuments.length) {
    log?.info("retrieval.representative.no_match", { userId, indexedDocumentCount: indexedDocuments.length });
    return [];
  }

  const documentIds = selectedDocuments.map((document) => document.id);
  const { data, error } = await supabase
    .from("chunks")
    .select("id, document_id, text_content, chunk_index, documents!inner(filename, source_scope)")
    .in("document_id", documentIds)
    .order("chunk_index", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 12));

  if (error) {
    log?.error("retrieval.representative.chunks_failed", { errorCategory: "supabase_query", userId, limit, error });
    return [];
  }

  const context = ((data ?? []) as RepresentativeChunkRow[]).map((chunk) => rowToContext(chunk, 1));

  log?.info("retrieval.representative.complete", {
    userId,
    selectedDocumentCount: selectedDocuments.length,
    resultCount: context.length,
    durationMs: Date.now() - startedAt,
  });

  return context;
}

export function filterRelevantContext(context: RetrievedContext[], log?: RequestLogger): RetrievedContext[] {
  const strongMatches = context.filter((chunk) => chunk.score >= FILE_CONTEXT_MIN_SCORE).slice(0, MAX_CONTEXT_CHUNKS);
  if (strongMatches.length) {
    log?.info("retrieval.filter.complete", {
      beforeCount: context.length,
      afterCount: strongMatches.length,
      topScore: context[0]?.score ?? 0,
    });
    return strongMatches;
  }

  const topScore = context[0]?.score ?? 0;
  if (topScore >= FILE_CONTEXT_WEAK_SCORE) {
    const filtered = context.slice(0, Math.min(6, MAX_CONTEXT_CHUNKS));
    log?.info("retrieval.filter.complete", {
      beforeCount: context.length,
      afterCount: filtered.length,
      topScore,
    });
    return filtered;
  }

  log?.info("retrieval.filter.complete", { beforeCount: context.length, afterCount: 0, topScore });
  return [];
}

export function toSourceCitations(context: RetrievedContext[]): SourceCitation[] {
  return context.map((chunk) => ({
    document_id: chunk.document_id,
    filename: chunk.filename,
    chunk_id: chunk.chunk_id,
    chunk_index: chunk.chunk_index,
  }));
}
