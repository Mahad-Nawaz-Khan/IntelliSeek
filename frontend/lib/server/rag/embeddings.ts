import { getServerEnv } from "../env";

export const EMBEDDING_DIMENSION = 1024;

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "perplexity/pplx-embed-v1-0.6b";

type OpenRouterEmbeddingResponse = {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
};

function getEmbeddingModel() {
  return getServerEnv("OPENROUTER_EMBEDDING_MODEL") ?? DEFAULT_EMBEDDING_MODEL;
}

function getOpenRouterApiKey() {
  return getServerEnv("OPENROUTER_API_KEY");
}

function normalizeEmbeddingResponse(
  data: OpenRouterEmbeddingResponse,
  expectedCount: number,
): number[][] {
  const embeddings = data.data
    ?.slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((item) => item.embedding)
    .filter((embedding): embedding is number[] => Array.isArray(embedding));

  if (!embeddings || embeddings.length !== expectedCount) {
    throw new Error("Embedding provider returned an invalid response");
  }

  if (embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSION)) {
    throw new Error(`Embedding provider returned vectors with an unexpected dimension. Expected ${EMBEDDING_DIMENSION}.`);
  }

  return embeddings;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const inputs = texts.map((text) => text.trim()).filter(Boolean);
  if (!inputs.length) return [];

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getEmbeddingModel(),
      input: inputs,
    }),
  });

  if (!response.ok) {
    throw new Error("Embedding generation failed");
  }

  return normalizeEmbeddingResponse(
    (await response.json()) as OpenRouterEmbeddingResponse,
    inputs.length,
  );
}

export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}
