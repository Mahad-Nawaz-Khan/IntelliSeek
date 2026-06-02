import "server-only";

import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";

import { getServerEnv } from "./env";
import type { RetrievedContext } from "./rag/retriever";

const DEFAULT_GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

const STYLE_GUIDE = `Write like ChatGPT's web app: clear, direct, well-structured, and useful.

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
- If the user asks for an explanation, teach step by step with definitions, intuition, and a small example when helpful.
- If the user asks for a summary, start with the main idea, then key points.
- If the user asks for differences/comparisons, use bullets or a compact table.
- If the user asks for code or algorithms, include complexity when relevant.
- Avoid rigid labels like "Answer", "Explanation", "Where to find it", or "Quick example" unless the user asks for that structure.
- Do not use decorative language, emojis, tables unless comparison is genuinely useful, or unnecessary disclaimers.
- Keep the answer concise enough to read, but complete enough to be useful.`;

const GROUNDED_SYSTEM_PROMPT = `You are IntelliSeek, an academic document assistant for uploaded study material.

Your job:
- Use the uploaded-file context chunks as the main source anchor.
- Explain academic concepts clearly, as if helping a student prepare for an exam or viva.
- When the chunks only provide headings or partial context, explain standard academic concepts from general knowledge instead of stopping at the headings.

Grounding rules:
- Claims that come directly from uploaded material should include a citation in this exact format: [Source: filename].
- General background explanations do not need citations.
- Cite the filename that appears in the chunk metadata.
- Do not cite chunk IDs in the final answer unless the user asks for technical retrieval details.
- Do not invent citations.
- Do not cite files that are not present in the context.
- If the context is weak, partial, or does not answer the question, briefly say what the uploaded material confirms or lacks, then still help with a general explanation when the user asks about a standard academic concept.

Response style:
- Start with a direct answer to the question in plain language.
- Then add supporting points from the context only as needed.
- If the user asks what a concept is, explain the concept instead of only listing section headings or locations.
- If multiple chunks disagree, say so and explain the uncertainty.

${STYLE_GUIDE}`;

const GENERAL_SYSTEM_PROMPT = `You are IntelliSeek, an academic assistant.

The user's uploaded files were searched before this answer and no relevant uploaded-file content was found.

- Answer from general knowledge in a helpful study-assistant style.
- Briefly mention missing uploaded context only if it helps the user understand why there are no citations. Do not use a fixed opening sentence.
- Do not cite uploaded files.
- Do not imply that this answer came from the user's uploaded documents.
- Make the answer practical for a student: define terms, explain intuition, and give examples when helpful.

${STYLE_GUIDE}`;

function getGroqModel() {
  return getServerEnv("GROQ_CHAT_MODEL") ?? DEFAULT_GROQ_MODEL;
}

function createGroqClient() {
  const apiKey = getServerEnv("GROQ_API_KEY");
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  return new Groq({
    apiKey,
    maxRetries: DEFAULT_MAX_RETRIES,
    timeout: DEFAULT_TIMEOUT_MS,
  });
}

function buildContext(context: RetrievedContext[]) {
  return context
    .map(
      (chunk, index) =>
        `[Chunk ${index + 1}]\nSource: ${chunk.filename}\nChunk ID: ${chunk.chunk_id}\nChunk Index: ${chunk.chunk_index}\nSimilarity Score: ${chunk.score.toFixed(3)}\nText: ${chunk.text_content}`,
    )
    .join("\n\n");
}

async function* streamGroqText(messages: ChatCompletionMessageParam[]): AsyncGenerator<string, string> {
  const client = createGroqClient();
  const stream = await client.chat.completions.create({
    model: getGroqModel(),
    messages,
    temperature: 0.2,
    max_completion_tokens: 1100,
    stream: true,
  });

  let answer = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (!text) continue;

    answer += text;
    yield text;
  }

  const trimmed = answer.trim();
  if (!trimmed) throw new Error("Groq fallback answer generation returned no content");
  return trimmed;
}

export async function* streamGroqGroundedAnswer(
  question: string,
  context: RetrievedContext[],
): AsyncGenerator<string, string> {
  return yield* streamGroqText([
    { role: "system", content: GROUNDED_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Uploaded-file context chunks:\n${buildContext(context)}\n\nQuestion: ${question}`,
    },
  ]);
}

export async function* streamGroqGeneralAnswer(question: string): AsyncGenerator<string, string> {
  return yield* streamGroqText([
    { role: "system", content: GENERAL_SYSTEM_PROMPT },
    { role: "user", content: question },
  ]);
}

function cleanGeneratedTitle(title: string) {
  return title
    .replace(/["'`]/g, "")
    .replace(/[.!?;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export async function generateGroqChatTitle(question: string, answer: string): Promise<string> {
  const client = createGroqClient();
  const completion = await client.chat.completions.create({
    model: getGroqModel(),
    messages: [
      {
        role: "system",
        content: "Create a concise chat title. Use 3-7 words. No quotes. Avoid punctuation-heavy output. Return only the title.",
      },
      {
        role: "user",
        content: `User question:\n${question}\n\nAssistant answer:\n${answer.slice(0, 1200)}`,
      },
    ],
    temperature: 0.2,
    max_completion_tokens: 32,
  });

  const title = cleanGeneratedTitle(completion.choices[0]?.message?.content ?? "");
  if (!title) throw new Error("Groq title generation returned no content");
  return title;
}
