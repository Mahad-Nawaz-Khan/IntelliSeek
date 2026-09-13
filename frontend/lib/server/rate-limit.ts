import "server-only";

import { getServerEnv } from "./env";
import type { RequestLogger } from "./logger";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  log?: RequestLogger;
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

/**
 * The in-memory limiter lives in one serverless instance, so it is a
 * best-effort backstop rather than a real global limit: a cold start forgets
 * every bucket, and concurrent instances each track their own. Upstash is what
 * makes the limit shared; these bounds only stop a flood of unique keys from
 * growing the map without end.
 */
const MAX_TRACKED_KEYS = 10_000;
const PRUNE_KEY_THRESHOLD = 1_000;
const PRUNE_INTERVAL_MS = 30_000;

const buckets = new Map<string, RateLimitEntry>();
let lastPrunedAt = 0;
let warnedAboutMemoryLimiter = false;

function now() {
  return Date.now();
}

function pruneExpiredBuckets(currentTime: number) {
  if (buckets.size < PRUNE_KEY_THRESHOLD) return;
  // Pruning walks the whole map, so it is throttled rather than run on every
  // request once the map is large.
  if (currentTime - lastPrunedAt < PRUNE_INTERVAL_MS && buckets.size < MAX_TRACKED_KEYS) return;
  lastPrunedAt = currentTime;

  buckets.forEach((entry, key) => {
    if (entry.resetAt <= currentTime) buckets.delete(key);
  });

  // Every remaining bucket is still live, so eviction has to drop real state.
  // Insertion order approximates expiry order, so the oldest entries go first.
  if (buckets.size < MAX_TRACKED_KEYS) return;
  const excess = buckets.size - MAX_TRACKED_KEYS;
  let evicted = 0;
  for (const key of buckets.keys()) {
    if (evicted >= excess) break;
    buckets.delete(key);
    evicted += 1;
  }
}

function getUpstashConfig() {
  const url = getServerEnv("UPSTASH_REDIS_REST_URL");
  const token = getServerEnv("UPSTASH_REDIS_REST_TOKEN");
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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

  if (!response.ok) throw new Error(`Rate limiter request failed with status ${response.status}`);

  const results = (await response.json()) as UpstashPipelineResult;
  const error = results.find((result) => result.error)?.error;
  if (error) throw new Error(`Rate limiter command failed: ${error}`);

  const count = toNumber(results[0]?.result);
  // A missing counter means the pipeline shape is not what this code assumes.
  // Throwing routes it through the degraded path instead of guessing a verdict.
  if (count === null) throw new Error("Rate limiter returned no counter value");

  // `PTTL` returns -1 for a key with no expiry and -2 for one that expired
  // between `INCR` and `PTTL`. Treating either as a full window keeps the
  // counter from being read as a permanent lockout.
  const reportedTtl = toNumber(results[2]?.result) ?? windowMs;
  const ttl = reportedTtl > 0 ? reportedTtl : windowMs;
  const resetAt = currentTime + ttl;

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfter: count <= limit ? 0 : Math.ceil(ttl / 1000),
  };
}

/**
 * Number of proxies between this app and the internet. The rightmost
 * `x-forwarded-for` entry is appended by the nearest proxy and is therefore the
 * only part a client cannot forge, so hops are counted from the right.
 */
function getTrustedProxyHops() {
  const configured = toNumber(getServerEnv("RATE_LIMIT_TRUSTED_PROXY_HOPS"));
  if (configured === null || configured < 1) return 1;
  return Math.min(Math.floor(configured), 10);
}

function normalizeIp(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  // `::ffff:203.0.113.5` and `203.0.113.5` are the same client, so they must not
  // land in two buckets. Bracketed and port-suffixed forms appear in some proxy
  // headers.
  const unbracketed = trimmed.replace(/^\[(.+)]$/, "$1");
  const mapped = unbracketed.replace(/^::ffff:/i, "");
  const withoutPort = /^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(mapped) ? mapped.split(":")[0] : mapped;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(withoutPort)) {
    return withoutPort.split(".").every((part) => Number(part) <= 255) ? withoutPort : null;
  }

  // IPv6, including the zone suffix some stacks append.
  const address = withoutPort.split("%")[0];
  return /^[0-9a-f:]{2,45}$/i.test(address) && address.includes(":") ? address.toLowerCase() : null;
}

/**
 * The client address, or `"unknown"` when no header can be trusted.
 *
 * `x-forwarded-for` is appendable by the client, so reading its leftmost entry
 * lets a caller mint a fresh rate-limit bucket per request. Headers a platform
 * sets itself are preferred, and the forwarded chain is only read from the right.
 * Values that are not addresses are discarded rather than used as keys.
 */
export function getClientIp(request: Request) {
  const platformIp = normalizeIp(request.headers.get("cf-connecting-ip"))
    ?? normalizeIp(request.headers.get("x-real-ip"))
    ?? normalizeIp(request.headers.get("x-vercel-forwarded-for"));
  if (platformIp) return platformIp;

  const chain = request.headers.get("x-forwarded-for")?.split(",") ?? [];
  const hopIndex = chain.length - getTrustedProxyHops();
  return normalizeIp(chain[hopIndex]) ?? "unknown";
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const upstash = getUpstashConfig();
  if (!upstash) {
    // Worth saying once per instance: without Upstash the limit is per-instance
    // and forgotten on every cold start, which is not what a deployed limit
    // is assumed to mean.
    if (!warnedAboutMemoryLimiter && process.env.NODE_ENV === "production") {
      warnedAboutMemoryLimiter = true;
      options.log?.warn("rate_limit.memory_only", {
        errorCategory: "rate_limit",
        reason: "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not configured",
      });
    }
    return memoryRateLimit(options);
  }

  try {
    return await upstashRateLimit(upstash, options);
  } catch (error) {
    // Previously this denied the request and logged nothing, so a limiter
    // outage or a bad token took every rate-limited route offline silently.
    // Degrading to the in-memory limiter keeps a bound in place while leaving
    // the cause visible.
    options.log?.error("rate_limit.upstash_failed", { errorCategory: "rate_limit", error });
    return memoryRateLimit(options);
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
