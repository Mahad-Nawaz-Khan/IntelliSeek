import { getServerEnv } from "../env";
import type { RequestLogger } from "../logger";

export const EMBEDDING_DIMENSION = 1024;

const OPENROUTER_EMBEDDINGS_URL = "https://openrouter.ai/api/v1/embeddings";
const DEFAULT_EMBEDDING_MODEL = "perplexity/pplx-embed-v1-0.6b";

/** Chunks per provider request, so a long document does not become one huge call. */
const MAX_BATCH_SIZE = 64;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function postEmbeddingRequest(
  inputs: string[],
  model: string,
  apiKey: string,
): Promise<Response> {
  return fetch(OPENROUTER_EMBEDDINGS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: inputs,
      dimensions: EMBEDDING_DIMENSION,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function handleFailedResponse(
  response: Response,
  model: string,
  inputCount: number,
  attempt: number,
  startedAt: number,
  log?: RequestLogger,
): boolean {
  const retryable = response.status === 429 || response.status >= 500;
  const level = retryable ? "warn" : "error";
  log?.[level]("embeddings.http.failed", {
    errorCategory: "embedding_failure",
    model,
    inputCount,
    status: response.status,
    attempt,
    durationMs: Date.now() - startedAt,
  });
  return retryable;
}

async function embedBatch(
  inputs: string[],
  model: string,
  apiKey: string,
  log?: RequestLogger,
): Promise<number[][]> {
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await postEmbeddingRequest(inputs, model, apiKey);
    } catch (error) {
      log?.warn("embeddings.http.unreachable", {
        errorCategory: "embedding_failure",
        model,
        inputCount: inputs.length,
        attempt,
        durationMs: Date.now() - startedAt,
        error,
      });
      if (attempt === MAX_ATTEMPTS) throw new Error("Embedding generation failed");
      await delay(RETRY_BASE_DELAY_MS * attempt);
      continue;
    }

    if (!response.ok) {
      const retryable = handleFailedResponse(response, model, inputs.length, attempt, startedAt, log);
      if (!retryable || attempt === MAX_ATTEMPTS) throw new Error("Embedding generation failed");
      await delay(RETRY_BASE_DELAY_MS * attempt);
      continue;
    }

    try {
      return normalizeEmbeddingResponse(
        (await response.json()) as OpenRouterEmbeddingResponse,
        inputs.length,
      );
    } catch (error) {
      log?.error("embeddings.response.invalid", {
        errorCategory: "embedding_failure",
        model,
        inputCount: inputs.length,
        attempt,
        durationMs: Date.now() - startedAt,
        error,
      });
      throw error;
    }
  }

  throw new Error("Embedding generation failed");
}

/**
 * Returns one vector per input, in input order.
 *
 * The 1:1 guarantee matters: callers pair the result with `chunks[index]`, so
 * silently dropping an input would shift every later vector onto the wrong
 * chunk and store embeddings that describe neighbouring text. Blank input is a
 * caller bug rather than something to paper over, so it throws.
 */
export async function embedTexts(texts: string[], log?: RequestLogger): Promise<number[][]> {
  if (!texts.length) return [];

  const inputs = texts.map((text) => text.trim());
  const blankIndex = inputs.findIndex((text) => !text);
  if (blankIndex !== -1) {
    log?.error("embeddings.input.blank", {
      errorCategory: "embedding_failure",
      inputCount: inputs.length,
      blankIndex,
    });
    throw new Error("Cannot embed blank text");
  }

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

  // Batched sequentially: a long document can produce hundreds of chunks, which
  // one request would either reject outright or time out on.
  const embeddings: number[][] = [];
  for (let start = 0; start < inputs.length; start += MAX_BATCH_SIZE) {
    const batch = inputs.slice(start, start + MAX_BATCH_SIZE);
    embeddings.push(...await embedBatch(batch, model, apiKey, log));
  }

  if (embeddings.length !== inputs.length) {
    log?.error("embeddings.count.mismatch", {
      errorCategory: "embedding_failure",
      model,
      inputCount: inputs.length,
      embeddingCount: embeddings.length,
    });
    throw new Error("Embedding provider returned an invalid response");
  }

  log?.info("embeddings.complete", {
    model,
    inputCount: inputs.length,
    embeddingCount: embeddings.length,
    durationMs: Date.now() - startedAt,
  });

  return embeddings;
}

export async function embedText(text: string, log?: RequestLogger): Promise<number[]> {
  const [embedding] = await embedTexts([text], log);
  if (!embedding) throw new Error("Embedding generation failed");
  return embedding;
}
