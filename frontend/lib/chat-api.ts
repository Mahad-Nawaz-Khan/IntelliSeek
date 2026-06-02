import type { AutocompleteSuggestionMetadata } from "./trie-autocomplete";

export type ChatRetrievalHint = AutocompleteSuggestionMetadata;

export type SourceCitation = {
  document_id: string;
  filename: string;
  chunk_id: string;
  chunk_index: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  displayedContent?: string;
  sources?: SourceCitation[];
  status: "complete" | "loading" | "error";
  createdAt: number;
};

export type ChatRequest = {
  question: string;
  retrievalHint?: ChatRetrievalHint;
  chatSessionId?: string;
};

type ChatRequestOptions = {
  retrievalHint?: ChatRetrievalHint;
  chatSessionId?: string | null;
};

export type ChatResponse = {
  ok: true;
  answer: string;
  sources: SourceCitation[];
  chatSessionId?: string;
};

export type ChatSessionSummary = {
  id: string;
  title: string;
  title_status?: "pending" | "generated" | "fallback";
  created_at?: string;
  updated_at?: string;
};

export type ChatSessionMessagesResponse = {
  ok: true;
  session: ChatSessionSummary;
  messages: ChatMessage[];
};

type ChatErrorResponse = {
  ok: false;
  status?: string;
  error?: string;
};

type StreamChatHandlers = {
  onDelta: (text: string) => void;
  onSources?: (sources: SourceCitation[]) => void;
  onDone?: (response: ChatResponse) => void;
};

type StreamEvent = {
  event: string;
  data: unknown;
};

const CHAT_ENDPOINT = "/api/chat";

function requireQuestion(question: string) {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) throw new Error("Enter a question before sending.");
  return trimmedQuestion;
}

async function parseJsonError(response: Response) {
  const data = (await response.json().catch(() => null)) as ChatErrorResponse | null;
  return data?.error ?? "The assistant could not answer this question.";
}

function parseSseFrame(frame: string): StreamEvent | null {
  let event = "message";
  const dataLines: string[] = [];

  frame.split("\n").forEach((line) => {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    if (line.startsWith("data: ")) dataLines.push(line.slice(6));
  });

  if (!dataLines.length) return null;

  try {
    return { event, data: JSON.parse(dataLines.join("\n")) as unknown };
  } catch {
    return null;
  }
}

function isSourceCitationArray(value: unknown): value is SourceCitation[] {
  return Array.isArray(value);
}

export async function submitChatQuestion(question: string, options: ChatRequestOptions = {}): Promise<ChatResponse> {
  const trimmedQuestion = requireQuestion(question);

  try {
    const payload: ChatRequest = {
      question: trimmedQuestion,
      ...(options.retrievalHint ? { retrievalHint: options.retrievalHint } : {}),
      ...(options.chatSessionId ? { chatSessionId: options.chatSessionId } : {}),
    };

    const response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as ChatResponse | ChatErrorResponse;

    if (!response.ok || !data.ok) {
      throw new Error(
        "error" in data && data.error
          ? data.error
          : "The assistant could not answer this question.",
      );
    }

    if (!data.answer?.trim()) {
      throw new Error("The assistant returned an empty answer.");
    }

    return {
      ok: true,
      answer: data.answer,
      sources: Array.isArray(data.sources) ? data.sources : [],
      chatSessionId: data.chatSessionId,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Could not reach the chat service.");
  }
}

export async function streamChatQuestion(question: string, handlers: StreamChatHandlers, options: ChatRequestOptions = {}): Promise<ChatResponse> {
  const trimmedQuestion = requireQuestion(question);
  const payload: ChatRequest = {
    question: trimmedQuestion,
    ...(options.retrievalHint ? { retrievalHint: options.retrievalHint } : {}),
    ...(options.chatSessionId ? { chatSessionId: options.chatSessionId } : {}),
  };
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(await parseJsonError(response));
  if (!response.body) throw new Error("The chat service did not return a stream.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let sources: SourceCitation[] = [];
  let finalAnswer = "";
  let finalSources: SourceCitation[] = [];
  let finalChatSessionId: string | undefined;
  let sawDone = false;

  function handleEvent(streamEvent: StreamEvent) {
    const data = streamEvent.data as Record<string, unknown>;

    if (streamEvent.event === "delta") {
      const text = typeof data.text === "string" ? data.text : "";
      if (!text) return;
      answer += text;
      handlers.onDelta(text);
      return;
    }

    if (streamEvent.event === "sources") {
      sources = isSourceCitationArray(data.sources) ? data.sources : [];
      handlers.onSources?.(sources);
      return;
    }

    if (streamEvent.event === "done") {
      finalAnswer = typeof data.answer === "string" ? data.answer : answer;
      finalSources = isSourceCitationArray(data.sources) ? data.sources : sources;
      const chatSessionId = typeof data.chatSessionId === "string" ? data.chatSessionId : undefined;
      finalChatSessionId = chatSessionId;
      sawDone = true;
      handlers.onDone?.({ ok: true, answer: finalAnswer, sources: finalSources, chatSessionId });
      return;
    }

    if (streamEvent.event === "error") {
      throw new Error(typeof data.error === "string" ? data.error : "The assistant could not answer this question.");
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const streamEvent = parseSseFrame(frame.trim());
      if (streamEvent) handleEvent(streamEvent);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const streamEvent = parseSseFrame(buffer.trim());
    if (streamEvent) handleEvent(streamEvent);
  }

  if (!sawDone) throw new Error("The assistant stream ended before completion.");
  if (!finalAnswer.trim()) throw new Error("The assistant returned an empty answer.");

  return { ok: true, answer: finalAnswer, sources: finalSources, chatSessionId: finalChatSessionId };
}

export async function fetchChatSessions(): Promise<ChatSessionSummary[]> {
  const response = await fetch("/api/chat/sessions");
  const data = (await response.json().catch(() => null)) as { ok?: boolean; sessions?: ChatSessionSummary[]; error?: string } | null;
  if (!response.ok || !data?.ok) throw new Error(data?.error ?? "Could not load recent chats");
  return data.sessions ?? [];
}

export async function fetchChatSessionMessages(sessionId: string, signal?: AbortSignal): Promise<ChatSessionMessagesResponse> {
  const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { signal });
  const data = (await response.json().catch(() => null)) as (ChatSessionMessagesResponse | ChatErrorResponse) | null;
  if (!response.ok || !data?.ok) {
    const error = data && "error" in data ? data.error : undefined;
    throw new Error(error ?? "Could not load chat session");
  }
  return data as ChatSessionMessagesResponse;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !data?.ok) throw new Error(data?.error ?? "Could not delete chat session");
}
