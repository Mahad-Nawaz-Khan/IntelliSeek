import "server-only";

import { getServerEnv } from "./env";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
};

type UpstashPipelineResult = Array<{
  result?: unknown;
  error?: string;
}>;

const buckets = new Map<string, RateLimitEntry>();

function now() {
  return Date.now();
}

function pruneExpiredBuckets(currentTime: number) {
  if (buckets.size < 1000) return;

  buckets.forEach((entry, key) => {
    if (entry.resetAt <= currentTime) buckets.delete(key);
  });
}

function getUpstashConfig() {
  const url = getServerEnv("UPSTASH_REDIS_REST_URL");
  const token = getServerEnv("UPSTASH_REDIS_REST_TOKEN");
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function memoryRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const currentTime = now();
  pruneExpiredBuckets(currentTime);

  const current = buckets.get(key);
  if (!current || current.resetAt <= currentTime) {
    buckets.set(key, { count: 1, resetAt: currentTime + windowMs });
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetAt: currentTime + windowMs,
      retryAfter: 0,
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfter: Math.ceil((current.resetAt - currentTime) / 1000),
    };
  }

  current.count += 1;
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfter: 0,
  };
}

async function upstashRateLimit(
  config: { url: string; token: string },
  { key, limit, windowMs }: RateLimitOptions,
): Promise<RateLimitResult> {
  const currentTime = now();
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, windowMs, "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Rate limiter request failed");

  const results = (await response.json()) as UpstashPipelineResult;
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error("Rate limiter command failed");

  const count = toNumber(results[0]?.result, limit + 1);
  const ttl = toNumber(results[2]?.result, windowMs);
  const resetAt = currentTime + Math.max(ttl, 0);
  const remaining = Math.max(0, limit - count);

  return {
    allowed: count <= limit,
    limit,
    remaining,
    resetAt,
    retryAfter: count <= limit ? 0 : Math.ceil(Math.max(ttl, 0) / 1000),
  };
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("cf-connecting-ip")
    ?? "unknown";
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const upstash = getUpstashConfig();
  if (!upstash) return memoryRateLimit(options);

  try {
    return await upstashRateLimit(upstash, options);
  } catch {
    return {
      allowed: false,
      limit: options.limit,
      remaining: 0,
      resetAt: now() + options.windowMs,
      retryAfter: Math.ceil(options.windowMs / 1000),
    };
  }
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfter) }),
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { ok: false, error: "Too many requests. Please try again shortly." },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}
