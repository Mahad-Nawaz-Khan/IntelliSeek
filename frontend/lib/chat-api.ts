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
  signal?: AbortSignal;
};

export type ChatResponse = {
  ok: true;
  answer: string;
  sources: SourceCitation[];
  chatSessionId?: string;
  title?: string;
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
  /**
   * A fallback provider restarted the answer. Clear the text rendered so far,
   * otherwise the partial first attempt stays glued to the front of the retry.
   */
  onReset?: () => void;
  /** The server-side job id for this answer; needed to cancel it via Stop. */
  onJob?: (jobId: string) => void;
  onSources?: (sources: SourceCitation[]) => void;
  onDone?: (response: ChatResponse) => void;
  /** The session title, which is generated after the answer completes. */
  onTitle?: (title: string) => void;
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

type StreamChatAccumulator = {
  answer: string;
  sources: SourceCitation[];
  finalAnswer: string;
  finalSources: SourceCitation[];
  finalChatSessionId?: string;
  finalTitle?: string;
  sawDone: boolean;
};

function handleJobEvent(data: Record<string, unknown>, handlers: StreamChatHandlers) {
  if (typeof data.jobId === "string" && data.jobId) {
    handlers.onJob?.(data.jobId);
  }
}

function handleDeltaEvent(
  data: Record<string, unknown>,
  state: StreamChatAccumulator,
  handlers: StreamChatHandlers,
) {
  if (typeof data.text === "string" && data.text) {
    state.answer += data.text;
    handlers.onDelta(data.text);
  }
}

function handleSourcesEvent(
  data: Record<string, unknown>,
  state: StreamChatAccumulator,
  handlers: StreamChatHandlers,
) {
  state.sources = isSourceCitationArray(data.sources) ? data.sources : [];
  handlers.onSources?.(state.sources);
}

function handleDoneEvent(
  data: Record<string, unknown>,
  state: StreamChatAccumulator,
  handlers: StreamChatHandlers,
) {
  state.finalAnswer = typeof data.answer === "string" ? data.answer : state.answer;
  state.finalSources = isSourceCitationArray(data.sources) ? data.sources : state.sources;
  state.finalChatSessionId = typeof data.chatSessionId === "string" ? data.chatSessionId : undefined;
  state.sawDone = true;
  handlers.onDone?.({
    ok: true,
    answer: state.finalAnswer,
    sources: state.finalSources,
    chatSessionId: state.finalChatSessionId,
  });
}

function handleTitleEvent(
  data: Record<string, unknown>,
  state: StreamChatAccumulator,
  handlers: StreamChatHandlers,
) {
  if (typeof data.title === "string" && data.title) {
    state.finalTitle = data.title;
    handlers.onTitle?.(data.title);
  }
}

function dispatchStreamEvent(
  streamEvent: StreamEvent,
  state: StreamChatAccumulator,
  handlers: StreamChatHandlers,
) {
  const data = (streamEvent.data ?? {}) as Record<string, unknown>;

  switch (streamEvent.event) {
    case "job":
      handleJobEvent(data, handlers);
      break;
    case "delta":
      handleDeltaEvent(data, state, handlers);
      break;
    case "reset":
      state.answer = "";
      handlers.onReset?.();
      break;
    case "sources":
      handleSourcesEvent(data, state, handlers);
      break;
    case "done":
      handleDoneEvent(data, state, handlers);
      break;
    case "title":
      handleTitleEvent(data, state, handlers);
      break;
    case "error":
      throw new Error(typeof data.error === "string" ? data.error : "The assistant could not answer this question.");
  }
}

async function consumeSseReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
) {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const streamEvent = parseSseFrame(frame.trim());
      if (streamEvent) onEvent(streamEvent);
    }

    if (done) break;
  }

  if (buffer.trim()) {
    const streamEvent = parseSseFrame(buffer.trim());
    if (streamEvent) onEvent(streamEvent);
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
    signal: options.signal,
  });

  if (!response.ok) throw new Error(await parseJsonError(response));
  if (!response.body) throw new Error("The chat service did not return a stream.");

  const state: StreamChatAccumulator = {
    answer: "",
    sources: [],
    finalAnswer: "",
    finalSources: [],
    sawDone: false,
  };

  await consumeSseReader(response.body.getReader(), (event) => {
    dispatchStreamEvent(event, state, handlers);
  });

  if (!state.sawDone) throw new Error("The assistant stream ended before completion.");
  if (!state.finalAnswer.trim()) throw new Error("The assistant returned an empty answer.");

  return {
    ok: true,
    answer: state.finalAnswer,
    sources: state.finalSources,
    chatSessionId: state.finalChatSessionId,
    title: state.finalTitle,
  };
}

export async function streamChatQuestionDemo(question: string, handlers: StreamChatHandlers, signal?: AbortSignal): Promise<ChatResponse> {
  const trimmedQuestion = requireQuestion(question);
  const payload: ChatRequest = { question: trimmedQuestion };
  const response = await fetch("/api/chat/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) throw new Error(await parseJsonError(response));
  if (!response.body) throw new Error("The chat service did not return a stream.");

  const state: StreamChatAccumulator = {
    answer: "",
    sources: [],
    finalAnswer: "",
    finalSources: [],
    sawDone: false,
  };

  await consumeSseReader(response.body.getReader(), (event) => {
    dispatchStreamEvent(event, state, handlers);
  });

  if (!state.sawDone) throw new Error("The assistant stream ended before completion.");
  if (!state.finalAnswer.trim()) throw new Error("The assistant returned an empty answer.");

  return { ok: true, answer: state.finalAnswer, sources: state.finalSources };
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
  return data;
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
  const data = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!response.ok || !data?.ok) throw new Error(data?.error ?? "Could not delete chat session");
}

export async function renameChatSession(sessionId: string, title: string): Promise<ChatSessionSummary> {
  const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; error?: string; session?: ChatSessionSummary }
    | null;
  if (!response.ok || !data?.ok || !data.session) throw new Error(data?.error ?? "Could not rename chat session");
  return data.session;
}
