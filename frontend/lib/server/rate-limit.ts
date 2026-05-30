import "server-only";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

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

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("cf-connecting-ip")
    ?? "unknown";
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions) {
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

export function rateLimitHeaders(result: ReturnType<typeof checkRateLimit>) {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfter) }),
  };
}

export function rateLimitResponse(result: ReturnType<typeof checkRateLimit>) {
  return Response.json(
    { ok: false, error: "Too many requests. Please try again shortly." },
    { status: 429, headers: rateLimitHeaders(result) },
  );
}
