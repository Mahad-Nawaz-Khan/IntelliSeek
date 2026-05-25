import "server-only";

import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI, tool } from "@openai/agents";
import OpenAI from "openai";
import { z } from "zod";

import type { SourceCitation } from "../../chat-api";
import { getServerEnv } from "../env";
import { validateQuestion } from "../rag/retriever";
import { getSupabaseServiceClient } from "../supabase";
import { matchUserChunks, type RetrievedChunk } from "../rag/vector-store";
import { embedText } from "../rag/embeddings";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_CHAT_MODEL = "openai/gpt-5-nano";
const MAX_DOCUMENT_CHUNKS = 20;

const SYSTEM_PROMPT = `You are IntelliSeek, an academic document assistant for uploaded study material.
Use the available tools before deciding that context is missing.
For broad questions about a named document, first find the document, then read representative chunks from that document.
For specific questions, search the user's chunks semantically.
Answer in a helpful study-assistant style while staying grounded in the retrieved chunks.
Cite factual claims with [Source: filename].
If a document or answer cannot be found in the uploaded material, say exactly what is missing.
Do not invent citations or use documents that tools did not return.`;

type AgentToolChunk = RetrievedChunk;

type AgentRunResult = {
  answer: string;
  sources: SourceCitation[];
};

type DocumentRow = {
  id: string;
  filename: string;
  created_at: string;
};

type ChunkRow = {
  id: string;
  document_id: string;
  text_content: string;
  chunk_index: number;
  documents?: {
    filename?: string | null;
  } | null;
};

function getOpenRouterBaseUrl() {
  return getServerEnv("OPENROUTER_BASE_URL") ?? DEFAULT_OPENROUTER_BASE_URL;
}

function getChatModel() {
  return getServerEnv("OPENROUTER_CHAT_MODEL") ?? DEFAULT_CHAT_MODEL;
}

function createOpenRouterClient() {
  const apiKey = getServerEnv("OPENROUTER_API_KEY");
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  return new OpenAI({
    apiKey,
    baseURL: getOpenRouterBaseUrl(),
    defaultHeaders: {
      "HTTP-Referer": getServerEnv("OPENROUTER_HTTP_REFERER") ?? "http://localhost:3000",
      "X-Title": getServerEnv("OPENROUTER_APP_TITLE") ?? "IntelliSeek",
    },
  });
}

function toSourceCitation(chunk: AgentToolChunk): SourceCitation {
  return {
    document_id: chunk.document_id,
    filename: chunk.filename,
    chunk_id: chunk.chunk_id,
    chunk_index: chunk.chunk_index,
  };
}

function uniqueSources(chunks: AgentToolChunk[]): SourceCitation[] {
  const seen = new Set<string>();
  const sources: SourceCitation[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.document_id}:${chunk.chunk_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push(toSourceCitation(chunk));
  }

  return sources;
}

async function findUserDocuments(userId: string, query: string, limit: number): Promise<DocumentRow[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service client is not configured");

  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, created_at")
    .eq("user_id", userId)
    .ilike("filename", `%${query}%`)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 10));

  if (error) throw new Error("Could not find documents");
  return (data ?? []) as DocumentRow[];
}

async function getUserDocumentChunks(userId: string, documentId: string, limit: number): Promise<AgentToolChunk[]> {
  const supabase = getSupabaseServiceClient();
  if (!supabase) throw new Error("Supabase service client is not configured");

  const { data, error } = await supabase
    .from("chunks")
    .select("id, document_id, text_content, chunk_index, documents!inner(filename, user_id)")
    .eq("document_id", documentId)
    .eq("documents.user_id", userId)
    .order("chunk_index", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), MAX_DOCUMENT_CHUNKS));

  if (error) throw new Error("Could not load document chunks");

  return ((data ?? []) as ChunkRow[]).map((chunk) => ({
    chunk_id: chunk.id,
    document_id: chunk.document_id,
    filename: chunk.documents?.filename ?? "Uploaded document",
    text_content: chunk.text_content,
    chunk_index: chunk.chunk_index,
    score: 1,
  }));
}

export async function generateAgentAnswer(question: string, userId: string): Promise<AgentRunResult> {
  const client = createOpenRouterClient();
  setDefaultOpenAIClient(client);
  setOpenAIAPI("chat_completions");

  const usedChunks: AgentToolChunk[] = [];

  const searchChunks = tool({
    name: "search_chunks",
    description: "Search the user's uploaded document chunks semantically for a specific question or concept.",
    parameters: z.object({
      query: z.string().describe("The search query to match against uploaded document chunks."),
      limit: z.number().int().min(1).max(10).default(5).describe("Maximum chunks to return."),
    }),
    execute: async ({ query, limit }) => {
      const validatedQuery = validateQuestion(query);
      const queryEmbedding = await embedText(validatedQuery);
      const chunks = await matchUserChunks(userId, queryEmbedding, limit);
      usedChunks.push(...chunks);
      return JSON.stringify(chunks);
    },
  });

  const findDocuments = tool({
    name: "find_documents",
    description: "Find the user's uploaded documents by filename or partial filename before answering document-specific questions.",
    parameters: z.object({
      filename: z.string().describe("Filename or partial filename to search for."),
      limit: z.number().int().min(1).max(10).default(5).describe("Maximum documents to return."),
    }),
    execute: async ({ filename, limit }) => JSON.stringify(await findUserDocuments(userId, filename, limit)),
  });

  const getDocumentChunks = tool({
    name: "get_document_chunks",
    description: "Read representative chunks from one user-owned document for summaries, outlines, topic lists, or exam prep questions.",
    parameters: z.object({
      document_id: z.string().uuid().describe("The document ID returned by find_documents."),
      limit: z.number().int().min(1).max(MAX_DOCUMENT_CHUNKS).default(12).describe("Maximum chunks to read from the document."),
    }),
    execute: async ({ document_id, limit }) => {
      const chunks = await getUserDocumentChunks(userId, document_id, limit);
      usedChunks.push(...chunks);
      return JSON.stringify(chunks);
    },
  });

  const agent = new Agent({
    name: "IntelliSeek Academic Assistant",
    instructions: SYSTEM_PROMPT,
    model: getChatModel(),
    tools: [searchChunks, findDocuments, getDocumentChunks],
  });

  const result = await run(agent, question, { maxTurns: 6 });
  const answer = result.finalOutput?.trim();
  if (!answer) throw new Error("Agent answer generation returned no content");

  return {
    answer,
    sources: uniqueSources(usedChunks),
  };
}
