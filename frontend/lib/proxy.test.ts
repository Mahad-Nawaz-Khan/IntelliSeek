import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetClaims = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: mockGetClaims,
      getUser: mockGetUser,
    },
  }),
}));

import { proxy } from "../proxy";

function requestFor(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

describe("proxy middleware auth gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes a protected route through when claims verify locally", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });

    const response = await proxy(requestFor("/chat"));
    expect(response.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("refreshes an expired session via getUser instead of bouncing to sign-in", async () => {
    // First getClaims: expired token rejected. getUser renews via the refresh
    // token, after which the rewritten cookie verifies.
    mockGetClaims
      .mockResolvedValueOnce({ data: null, error: new Error("expired") })
      .mockResolvedValueOnce({ data: { claims: { sub: "user-1" } }, error: null });
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await proxy(requestFor("/chat"));
    expect(response.status).toBe(200);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it("redirects a protected route to sign-in with next preserved when unauthenticated", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: new Error("no session") });
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await proxy(requestFor("/chat"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("next")).toBe("/chat");
  });

  it("lets public routes through even without a valid session", async () => {
    // data null with error null = no session cookie at all, so no recovery
    // round-trip should be attempted for anonymous visitors.
    mockGetClaims.mockResolvedValue({ data: null, error: null });

    const response = await proxy(requestFor("/"));
    expect(response.status).toBe(200);
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("redirects an authenticated visitor from / to /chat before the page renders", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });

    const response = await proxy(requestFor("/"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/chat");
  });

  it("redirects an authenticated visitor away from the sign-in page", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });

    const response = await proxy(requestFor("/sign-in"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/chat");
  });

  it("sends an authenticated visitor from sign-in to the requested next path", async () => {
    mockGetClaims.mockResolvedValue({ data: { claims: { sub: "user-1" } }, error: null });

    const response = await proxy(requestFor("/sign-in?next=%2Flibrary"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/library");
  });

  it("keeps an unauthenticated visitor on the sign-in page", async () => {
    mockGetClaims.mockResolvedValue({ data: null, error: new Error("no session") });

    const response = await proxy(requestFor("/sign-in"));
    expect(response.status).toBe(200);
  });
});
