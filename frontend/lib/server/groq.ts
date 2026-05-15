import { getServerEnv } from "./env";
import type { RetrievedContext } from "./rag/retriever";

const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const SYSTEM_PROMPT = `You are IntelliSeek, an academic retrieval assistant.
Answer only using the provided context chunks.
Every factual claim must be supported by a citation in the format [Source: filename].
If the context does not contain enough information to answer, say that the uploaded material does not contain enough information.
Do not use outside knowledge, do not invent citations, and do not mention sources that are not present in the context.`;

function buildContext(context: RetrievedContext[]): string {
  return context
    .map(
      (chunk, index) =>
        `[Chunk ${index + 1}]\nSource: ${chunk.filename}\nChunk ID: ${chunk.chunk_id}\nText: ${chunk.text_content}`,
    )
    .join("\n\n");
}

export async function generateAnswer(
  question: string,
  context: RetrievedContext[],
): Promise<string> {
  const apiKey = getServerEnv("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Context chunks:\n${buildContext(context)}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 700,
    }),
  });

  if (!response.ok) {
    throw new Error("Answer generation failed");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const answer = data.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("Answer generation returned no content");
  return answer;
}
