import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, getClientIp, rateLimitHeaders, rateLimitResponse } from "./rate-limit";

function requestWithHeaders(headers: Record<string, string>) {
  return new Request("https://intelliseek.test/api/chat", { headers });
}

describe("getClientIp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers headers only the platform can set", () => {
    const request = requestWithHeaders({
      "cf-connecting-ip": "203.0.113.9",
      "x-real-ip": "203.0.113.8",
      "x-forwarded-for": "1.2.3.4",
    });
    expect(getClientIp(request)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip, then the forwarded chain read from the right", () => {
    expect(getClientIp(requestWithHeaders({ "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
    expect(
      getClientIp(requestWithHeaders({ "x-forwarded-for": "198.51.100.7, 203.0.113.5" })),
    ).toBe("203.0.113.5");
  });

  it("counts hops from the right using RATE_LIMIT_TRUSTED_PROXY_HOPS", () => {
    vi.stubEnv("RATE_LIMIT_TRUSTED_PROXY_HOPS", "2");
    expect(
      getClientIp(requestWithHeaders({ "x-forwarded-for": "198.51.100.1,198.51.100.2" })),
    ).toBe("198.51.100.1");
  });

  it("clamps the hop count to at most 10", () => {
    vi.stubEnv("RATE_LIMIT_TRUSTED_PROXY_HOPS", "99");
    expect(
      getClientIp(requestWithHeaders({ "x-forwarded-for": "198.51.100.7, 203.0.113.5" })),
    ).toBe("unknown");
  });

  it("discards values that are not addresses instead of keying on them", () => {
    expect(getClientIp(requestWithHeaders({ "x-forwarded-for": "not-an-ip" }))).toBe("unknown");
    expect(getClientIp(requestWithHeaders({ "x-forwarded-for": "999.1.1.1" }))).toBe("unknown");
    expect(getClientIp(requestWithHeaders({}))).toBe("unknown");
  });

  it("normalizes spellings of one client into one bucket key", () => {
    expect(getClientIp(requestWithHeaders({ "x-forwarded-for": "::ffff:203.0.113.5" }))).toBe(
      "203.0.113.5",
    );
    expect(getClientIp(requestWithHeaders({ "x-forwarded-for": "[2001:DB8::1]" }))).toBe(
      "2001:db8::1",
    );
    expect(getClientIp(requestWithHeaders({ "x-forwarded-for": "fe80::1%eth0" }))).toBe("fe80::1");
    expect(getClientIp(requestWithHeaders({ "x-forwarded-for": "203.0.113.5:8443" }))).toBe(
      "203.0.113.5",
    );
  });
});

describe("checkRateLimit without Upstash (in-memory backstop)", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows up to the limit, then denies until the window resets", async () => {
    const options = { key: "ip:203.0.113.10", limit: 2, windowMs: 60_000 };
    const first = await checkRateLimit(options);
    const second = await checkRateLimit(options);
    const third = await checkRateLimit(options);

    expect(first).toMatchObject({ allowed: true, limit: 2, remaining: 1, retryAfter: 0 });
    expect(second).toMatchObject({ allowed: true, remaining: 0 });
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfter).toBeGreaterThanOrEqual(1);
    expect(third.resetAt).toBeGreaterThan(Date.now());
  });

  it("keeps buckets independent per key", async () => {
    await checkRateLimit({ key: "route:chat", limit: 1, windowMs: 60_000 });
    const other = await checkRateLimit({ key: "route:upload", limit: 1, windowMs: 60_000 });
    expect(other.allowed).toBe(true);
  });
});

describe("checkRateLimit with Upstash", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://cache.example.test");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("uses the shared counter verdict and the key's TTL", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      expect(String(input)).toBe("https://cache.example.test/pipeline");
      return new Response(JSON.stringify([{ result: 3 }, { result: 1 }, { result: 42_000 }]), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkRateLimit({ key: "chat:user-1", limit: 3, windowMs: 60_000 });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ allowed: true, limit: 3, remaining: 0, retryAfter: 0 });
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("degrades to the in-memory limiter when Upstash is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED");
      }),
    );

    const result = await checkRateLimit({ key: "chat:degraded", limit: 5, windowMs: 60_000 });
    expect(result).toMatchObject({ allowed: true, limit: 5, remaining: 4 });
  });

  it("degrades when the pipeline shape is not what the code assumes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ result: null }]), { status: 200 })),
    );

    const result = await checkRateLimit({ key: "chat:shape", limit: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
  });
});

describe("rateLimitHeaders", () => {
  it("reports the shared budget on allowed requests", () => {
    expect(
      rateLimitHeaders({
        allowed: true,
        limit: 30,
        remaining: 12,
        resetAt: 1_700_000_050_500,
        retryAfter: 0,
      }),
    ).toEqual({
      "X-RateLimit-Limit": "30",
      "X-RateLimit-Remaining": "12",
      "X-RateLimit-Reset": "1700000051",
    });
  });

  it("adds Retry-After only when the request is denied", () => {
    const headers = rateLimitHeaders({
      allowed: false,
      limit: 30,
      remaining: 0,
      resetAt: 1_700_000_050_000,
      retryAfter: 7,
    });
    expect(headers["Retry-After"]).toBe("7");
  });
});

describe("rateLimitResponse", () => {
  it("answers 429 with a retryable header set", async () => {
    const response = rateLimitResponse({
      allowed: false,
      limit: 10,
      remaining: 0,
      resetAt: Date.now() + 20_000,
      retryAfter: 20,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("20");
    await expect(response.json()).resolves.toMatchObject({ ok: false });
  });
});
