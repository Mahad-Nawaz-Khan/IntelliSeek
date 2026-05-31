import type { SourceCitation } from "../../chat-api";
import { embedText } from "./embeddings";
import { matchUserChunks, type RetrievedChunk } from "./vector-store";
import { getSupabaseServiceClient } from "../supabase";

const DEFAULT_TOP_K = 5;
const MAX_QUESTION_LENGTH = 1000;
export const FILE_CONTEXT_MIN_SCORE = 0.72;
export const FILE_CONTEXT_WEAK_SCORE = 0.62;

export type RetrievedContext = RetrievedChunk;

type RepresentativeChunkRow = {
  id: string;
  document_id: string;
  text_content: string;
  chunk_index: number;
  documents: Array<{
    filename: string | null;
  }> | {
    filename: string | null;
  } | null;
};

type IndexedDocumentRow = {
  id: string;
  filename: string;
};

type DocumentChunkRow = {
  id: string;
  document_id: string;
  text_content: string;
  chunk_index: number;
  documents: Array<{
    filename: string | null;
  }> | {
    filename: string | null;
  } | null;
};

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

function getJoinedDocument(row: RepresentativeChunkRow) {
  if (Array.isArray(row.documents)) return row.documents[0] ?? null;
  return row.documents;
}

function tokenizeSearchText(input: string) {
  return input
    .toLocaleLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !FILENAME_STOP_WORDS.has(token));
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
): Promise<RetrievedContext[]> {
  const queryEmbedding = await embedText(question);
  return matchUserChunks(userId, queryEmbedding, limit);
}

export function isDocumentSummaryRequest(question: string) {
  const normalized = question.toLocaleLowerCase();
  return SUMMARY_INTENT_PATTERN.test(normalized);
}

export async function hasIndexedDocuments(userId: string) {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("documents")
    .select("id")
    .eq("user_id", userId)
    .eq("processing_status", "indexed")
    .limit(1);

  return !error && Boolean(data?.length);
}

export async function retrieveDocumentContextByIds(
  userId: string,
  documentIds: string[],
  limit = 10,
): Promise<RetrievedContext[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const uniqueDocumentIds = [...new Set(documentIds.map((id) => id.trim()).filter(Boolean))].slice(0, 4);
  if (!uniqueDocumentIds.length) return [];

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, filename")
    .eq("user_id", userId)
    .eq("processing_status", "indexed")
    .in("id", uniqueDocumentIds);

  if (documentsError || !documents?.length) return [];

  const ownedDocumentIds = ((documents ?? []) as IndexedDocumentRow[]).map((document) => document.id);
  const { data, error } = await supabase
    .from("chunks")
    .select("id, document_id, text_content, chunk_index, documents!inner(filename)")
    .in("document_id", ownedDocumentIds)
    .order("chunk_index", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 20));

  if (error) return [];

  return ((data ?? []) as DocumentChunkRow[]).map((chunk) => ({
    chunk_id: chunk.id,
    document_id: chunk.document_id,
    filename: getJoinedDocument(chunk)?.filename ?? "Uploaded document",
    text_content: chunk.text_content,
    chunk_index: chunk.chunk_index,
    score: 1,
  }));
}

export async function retrieveRepresentativeDocumentContext(
  userId: string,
  limit = 8,
  question = "",
): Promise<RetrievedContext[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) return [];

  const { data: documents, error: documentsError } = await supabase
    .from("documents")
    .select("id, filename")
    .eq("user_id", userId)
    .eq("processing_status", "indexed")
    .order("created_at", { ascending: false })
    .limit(12);

  if (documentsError || !documents?.length) return [];

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

  if (!selectedDocuments.length) return [];

  const documentIds = selectedDocuments.map((document) => document.id);
  const { data, error } = await supabase
    .from("chunks")
    .select("id, document_id, text_content, chunk_index, documents!inner(filename)")
    .in("document_id", documentIds)
    .order("chunk_index", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 12));

  if (error) return [];

  return ((data ?? []) as RepresentativeChunkRow[]).map((chunk) => ({
    chunk_id: chunk.id,
    document_id: chunk.document_id,
    filename: getJoinedDocument(chunk)?.filename ?? "Uploaded document",
    text_content: chunk.text_content,
    chunk_index: chunk.chunk_index,
    score: 1,
  }));
}

export function filterRelevantContext(context: RetrievedContext[]): RetrievedContext[] {
  const strongMatches = context.filter((chunk) => chunk.score >= FILE_CONTEXT_MIN_SCORE);
  if (strongMatches.length) return strongMatches;

  const topScore = context[0]?.score ?? 0;
  if (topScore >= FILE_CONTEXT_WEAK_SCORE) return context.slice(0, 3);

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
