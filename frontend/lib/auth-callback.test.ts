import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExchangeCodeForSession = vi.fn();

vi.mock("./server/auth", () => ({
  createAuthClient: () => ({
    auth: { exchangeCodeForSession: mockExchangeCodeForSession },
  }),
}));

import { GET } from "../app/auth/callback/route";

function callbackUrl(query: string) {
  return new Request(`http://localhost:3000/auth/callback?${query}`);
}

async function locationOf(request: Request) {
  const response = await GET(request);
  return { status: response.status, location: response.headers.get("location") ?? "" };
}

describe("auth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects the popup to the self-closing complete page after a successful exchange", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const { status, location } = await locationOf(
      callbackUrl("code=abc&popup=1&next=%2Fchat"),
    );
    expect(status).toBe(307);
    expect(location).toBe("http://localhost:3000/auth/complete");
  });

  it("redirects a full-page flow to the requested next path after a successful exchange", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const { status, location } = await locationOf(callbackUrl("code=abc&next=%2Flibrary"));
    expect(status).toBe(307);
    expect(location).toBe("http://localhost:3000/library");
  });

  it("falls back to /chat when next is missing or unsafe", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });

    const { location } = await locationOf(callbackUrl("code=abc&next=https://evil.example"));
    expect(location).toBe("http://localhost:3000/chat");
  });

  it("sends a failed exchange back to sign-in with the error and next preserved", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: new Error("verifier mismatch") });

    const { status, location } = await locationOf(callbackUrl("code=abc&next=%2Flibrary"));
    expect(status).toBe(307);
    const url = new URL(location);
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("error")).toBe("auth_callback_failed");
    expect(url.searchParams.get("next")).toBe("/library");
  });

  it("sends a missing code back to sign-in with the error preserved", async () => {
    const { status, location } = await locationOf(callbackUrl("next=%2Fchat"));
    expect(status).toBe(307);
    const url = new URL(location);
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("error")).toBe("auth_callback_failed");
    expect(url.searchParams.get("next")).toBe("/chat");
  });
});
