import "server-only";

import { Agent, run, setDefaultOpenAIClient, setOpenAIAPI, setTracingDisabled, tool } from "@openai/agents";
setTracingDisabled(true);
import OpenAI from "openai";
import { z } from "zod";

import type { SourceCitation } from "../../chat-api";
import { getServerEnv } from "../env";
import { streamGroqGeneralAnswer, streamGroqGroundedAnswer } from "../groq";
import { embedText } from "../rag/embeddings";
import { mergeRetrievedContext, retrieveKeywordContext, toSourceCitations, validateQuestion, type RetrievedContext } from "../rag/retriever";
import { matchUserChunks, type RetrievedChunk } from "../rag/vector-store";
import { getSupabaseServiceClient } from "../supabase";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_CHAT_MODEL = "openai/gpt-5-nano";
const MAX_DOCUMENT_CHUNKS = 20;

const PRIMARY_STYLE_GUIDE = `Write like ChatGPT's web app: clear, direct, and easy to scan.

Formatting rules:
- Always use Markdown for formatting.
- Use # for main titles only when the answer is long enough to need a title.
- Use ## for sub-sections and ### for detailed breakdowns when structure helps readability.
- Use bullet points (-) or numbered lists for multiple items, comparisons, or step-by-step instructions.
- Bold key terms with **text** so important ideas are easy to scan.
- Keep paragraphs short and avoid large blocks of text.
- Get straight to the point. Do not begin with filler like "Here is the information you requested" or end with filler like "I hope this helps."
- Do not force headings or sections for simple answers.

Answer style:
- Start with a direct answer in plain language, then add supporting detail only as needed.
- For learning questions, include intuition and a small example when useful.
- For algorithms or code, include time/space complexity when relevant.
- Avoid rigid labels like "Answer", "Explanation", "Where to find it", or "Quick example" unless the user asks for that structure.
- Avoid decorative filler, over-formatting, and unnecessary disclaimers.`;

const SYSTEM_PROMPT = `You are IntelliSeek, an academic document assistant for uploaded study material.
Use the available tools before deciding that context is missing.
For broad questions about a named document, first find the document, then read representative chunks from that document.
For specific questions, search the user's chunks semantically.
Answer in a helpful, natural study-assistant style. Use retrieved chunks as the source anchor, but use normal academic knowledge to explain standard concepts clearly when the chunks are thin or only provide headings.
For topic summaries, use a brief intro followed by bullets only when that makes the answer easier to scan.
Cite claims that come directly from uploaded material with [Source: filename]. Do not cite general background knowledge.
If a document or answer cannot be found in the uploaded material, briefly say what is missing, then still help with a general explanation if the user asked about a standard academic concept.
Do not invent citations or use documents that tools did not return.

${PRIMARY_STYLE_GUIDE}`;

const GROUNDED_SYSTEM_PROMPT = `You are IntelliSeek, an academic retrieval assistant.
Use the provided uploaded-file context chunks as the main source anchor, not as a hard limit on helpfulness.
Cite claims that come directly from uploaded material with [Source: filename]. Do not cite general background knowledge.
When context only shows headings or weak snippets, say briefly what the uploaded material confirms, then answer the user's concept question from standard academic knowledge in a natural study-assistant style.
Do not invent citations or cite files that are not present in the context.
Do not turn normal questions into a table of contents. If the user asks what a concept is, explain the concept first, and mention section locations only if that is useful.

${PRIMARY_STYLE_GUIDE}`;

const GENERAL_SYSTEM_PROMPT = `You are IntelliSeek, an academic assistant.
The user's uploaded files were searched before this answer and no relevant uploaded-file content was found.
If it matters, briefly mention that the uploaded files did not provide relevant context. Do not use a fixed opening sentence.
Answer from general knowledge in a helpful study-assistant style.
Do not cite uploaded files or imply that this answer came from the user's files.

${PRIMARY_STYLE_GUIDE}`;

type AgentToolChunk = RetrievedChunk;

type AgentRunResult = {
  answer: string;
  sources: SourceCitation[];
};

export type ConversationTurn = {
  question: string;
  answer: string;
};

export type AgentAnswerStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; answer: string; sources: SourceCitation[] };

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

function configureAgentClient() {
  const client = createOpenRouterClient();
  setDefaultOpenAIClient(client);
  setOpenAIAPI("chat_completions");
}

function buildContextInput(context: RetrievedContext[]) {
  return context
    .map(
      (chunk, index) =>
        `[Chunk ${index + 1}]\nSource: ${chunk.filename}\nChunk ID: ${chunk.chunk_id}\nChunk Index: ${chunk.chunk_index}\nSimilarity Score: ${chunk.score.toFixed(3)}\nText: ${chunk.text_content}`,
    )
    .join("\n\n");
}

function buildConversationInput(question: string, conversationContext: ConversationTurn[] = []) {
  if (!conversationContext.length) return question;

  const priorTurns = conversationContext
    .map((turn, index) => `Turn ${index + 1}\nUser: ${turn.question}\nAssistant: ${turn.answer}`)
    .join("\n\n");

  return `Recent prior conversation for intent only:\n${priorTurns}\n\nCurrent user question:\n${question}`;
}

async function* streamAgentText(agent: Agent, input: string): AsyncGenerator<string, string> {
  const stream = await run(agent, input, { maxTurns: 1, stream: true });

  for await (const event of stream) {
    if (event.type === "raw_model_stream_event" && event.data.type === "output_text_delta" && event.data.delta) {
      yield event.data.delta;
    }
  }

  await stream.completed;
  const answer = stream.finalOutput?.trim();
  if (!answer) throw new Error("Agent answer generation returned no content");
  return answer;
}

function createAgentRun(userId: string) {
  configureAgentClient();

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
      const semanticChunks = await matchUserChunks(userId, queryEmbedding, Math.min(Math.max(limit * 2, 10), 20));
      const keywordChunks = await retrieveKeywordContext(validatedQuery, userId, limit);
      const chunks = mergeRetrievedContext(semanticChunks, keywordChunks).slice(0, limit);
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

  return {
    agent: new Agent({
      name: "IntelliSeek Academic Assistant",
      instructions: SYSTEM_PROMPT,
      model: getChatModel(),
      tools: [searchChunks, findDocuments, getDocumentChunks],
    }),
    getSources: () => uniqueSources(usedChunks),
  };
}

export async function generateAgentAnswer(question: string, userId: string, conversationContext: ConversationTurn[] = []): Promise<AgentRunResult> {
  const { agent, getSources } = createAgentRun(userId);
  const result = await run(agent, buildConversationInput(question, conversationContext), { maxTurns: 6 });
  const answer = result.finalOutput?.trim();
  if (!answer) throw new Error("Agent answer generation returned no content");

  return {
    answer,
    sources: getSources(),
  };
}

export async function* streamAgentAnswer(question: string, userId: string, conversationContext: ConversationTurn[] = []): AsyncGenerator<AgentAnswerStreamEvent> {
  const { agent, getSources } = createAgentRun(userId);
  const stream = await run(agent, buildConversationInput(question, conversationContext), { maxTurns: 6, stream: true });

  for await (const event of stream) {
    if (event.type === "raw_model_stream_event" && event.data.type === "output_text_delta" && event.data.delta) {
      yield { type: "delta", text: event.data.delta };
    }
  }

  await stream.completed;
  const answer = stream.finalOutput?.trim();
  if (!answer) throw new Error("Agent answer generation returned no content");

  yield { type: "done", answer, sources: getSources() };
}

export async function* streamGroundedAgentAnswer(
  question: string,
  context: RetrievedContext[],
  conversationContext: ConversationTurn[] = [],
): AsyncGenerator<AgentAnswerStreamEvent> {
  let answer = "";

  try {
    configureAgentClient();
    const agent = new Agent({
      name: "IntelliSeek Uploaded File Assistant",
      instructions: GROUNDED_SYSTEM_PROMPT,
      model: getChatModel(),
    });
    const input = `Uploaded-file context chunks:\n${buildContextInput(context)}\n\n${buildConversationInput(question, conversationContext)}`;
    const textStream = streamAgentText(agent, input);

    while (true) {
      const next = await textStream.next();
      if (next.done) {
        answer = next.value;
        break;
      }
      yield { type: "delta", text: next.value };
    }
  } catch {
    const fallbackStream = streamGroqGroundedAnswer(buildConversationInput(question, conversationContext), context);
    while (true) {
      const next = await fallbackStream.next();
      if (next.done) {
        answer = next.value;
        break;
      }
      yield { type: "delta", text: next.value };
    }
  }

  yield { type: "done", answer, sources: toSourceCitations(context) };
}

export async function* streamGeneralAgentAnswer(question: string, conversationContext: ConversationTurn[] = []): AsyncGenerator<AgentAnswerStreamEvent> {
  let answer = "";

  try {
    configureAgentClient();
    const agent = new Agent({
      name: "IntelliSeek General Assistant",
      instructions: GENERAL_SYSTEM_PROMPT,
      model: getChatModel(),
    });
    const textStream = streamAgentText(agent, buildConversationInput(question, conversationContext));

    while (true) {
      const next = await textStream.next();
      if (next.done) {
        answer = next.value;
        break;
      }
      yield { type: "delta", text: next.value };
    }
  } catch {
    const fallbackStream = streamGroqGeneralAnswer(buildConversationInput(question, conversationContext));
    while (true) {
      const next = await fallbackStream.next();
      if (next.done) {
        answer = next.value;
        break;
      }
      yield { type: "delta", text: next.value };
    }
  }

  yield { type: "done", answer, sources: [] };
}
