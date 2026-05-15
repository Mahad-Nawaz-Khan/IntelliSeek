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
  user_id: string;
};

export type ChatResponse = {
  ok: true;
  answer: string;
  sources: SourceCitation[];
};

type ChatErrorResponse = {
  ok: false;
  status?: string;
  error?: string;
};

const CHAT_ENDPOINT = "http://localhost:8000/api/chat";

export async function submitChatQuestion(
  question: string,
  userId: string,
): Promise<ChatResponse> {
  const trimmedQuestion = question.trim();
  if (!trimmedQuestion) {
    throw new Error("Enter a question before sending.");
  }

  try {
    const payload: ChatRequest = {
      question: trimmedQuestion,
      user_id: userId,
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
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Could not reach the chat service.");
  }
}
