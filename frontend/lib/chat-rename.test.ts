import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  from: vi.fn(),
}));

vi.mock("./server/auth", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

vi.mock("./server/supabase", () => ({
  getSupabaseServiceClient: () => {
    const builder = mocks.from();
    return { from: () => builder };
  },
}));

import { PATCH } from "../app/api/chat/sessions/[sessionId]/route";

const SESSION_ID = "7f9c24e5-3a1b-4c2d-8e6f-0a1b2c3d4e5f";
const UPDATED_SESSION = { id: SESSION_ID, title: "Renamed chat", title_status: "generated", created_at: "t", updated_at: "t2" };

function patchRequest(body: unknown) {
  return new Request(`http://localhost:3000/api/chat/sessions/${SESSION_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function routeContext() {
  return { params: Promise.resolve({ sessionId: SESSION_ID }) };
}

function mockUpdateChain(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const update = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
    }),
  });
  mocks.from.mockReturnValue({ update });
  return single;
}

describe("chat session rename endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a signed-in user", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const response = await PATCH(patchRequest({ title: "New name" }), routeContext());
    expect(response.status).toBe(401);
  });

  it("rejects empty titles", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });

    const response = await PATCH(patchRequest({ title: "   " }), routeContext());
    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejects titles over 80 characters", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });

    const response = await PATCH(patchRequest({ title: "x".repeat(81) }), routeContext());
    expect(response.status).toBe(400);
  });

  it("renames the session and marks the title as settled", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    const single = mockUpdateChain({ data: UPDATED_SESSION, error: null });

    const response = await PATCH(patchRequest({ title: "  Renamed   chat  " }), routeContext());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.session.title).toBe("Renamed chat");
    expect(single).toHaveBeenCalledTimes(1);
  });

  it("reports a missing session as 404", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mockUpdateChain({ data: null, error: { message: "no rows" } });

    const response = await PATCH(patchRequest({ title: "New name" }), routeContext());
    expect(response.status).toBe(404);
  });
});
