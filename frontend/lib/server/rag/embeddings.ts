import { getServerEnv } from "../env";
import type { RequestLogger } from "../logger";

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

export async function embedTexts(texts: string[], log?: RequestLogger): Promise<number[][]> {
  const inputs = texts.map((text) => text.trim()).filter(Boolean);
  if (!inputs.length) return [];

  const model = getEmbeddingModel();
  const startedAt = Date.now();
  log?.info("embeddings.start", { model, inputCount: inputs.length });

  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    log?.error("embeddings.api_key.missing", {
      errorCategory: "embedding_failure",
      model,
      inputCount: inputs.length,
    });
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: inputs,
    }),
  });

  if (!response.ok) {
    log?.error("embeddings.http.failed", {
      errorCategory: "embedding_failure",
      model,
      inputCount: inputs.length,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    throw new Error("Embedding generation failed");
  }

  try {
    const embeddings = normalizeEmbeddingResponse(
      (await response.json()) as OpenRouterEmbeddingResponse,
      inputs.length,
    );
    log?.info("embeddings.complete", {
      model,
      inputCount: inputs.length,
      embeddingCount: embeddings.length,
      durationMs: Date.now() - startedAt,
    });
    return embeddings;
  } catch (error) {
    log?.error("embeddings.response.invalid", {
      errorCategory: "embedding_failure",
      model,
      inputCount: inputs.length,
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}

export async function embedText(text: string, log?: RequestLogger): Promise<number[]> {
  const [embedding] = await embedTexts([text], log);
  return embedding;
}
