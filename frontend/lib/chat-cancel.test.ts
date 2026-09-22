import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  recordChatJobCancelled: vi.fn(),
}));

vi.mock("./server/auth", () => ({
  getAuthenticatedUser: mocks.getAuthenticatedUser,
}));

vi.mock("./server/chat-jobs", () => ({
  markChatJobCancelled: vi.fn(),
  recordChatJobCancelled: mocks.recordChatJobCancelled,
}));

import { POST } from "../app/api/chat/cancel/route";

function cancelRequest(body: unknown) {
  return new Request("http://localhost:3000/api/chat/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const JOB_ID = "7f9c24e5-3a1b-4c2d-8e6f-0a1b2c3d4e5f";

describe("chat cancel endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a signed-in user", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    const response = await POST(cancelRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(401);
    expect(mocks.recordChatJobCancelled).not.toHaveBeenCalled();
  });

  it("rejects an invalid job id", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });

    const response = await POST(cancelRequest({ jobId: "not-a-uuid" }));
    expect(response.status).toBe(400);
    expect(mocks.recordChatJobCancelled).not.toHaveBeenCalled();
  });

  it("records the cancellation for a valid request", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mocks.recordChatJobCancelled.mockResolvedValue(true);

    const response = await POST(cancelRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(200);
    expect(mocks.recordChatJobCancelled).toHaveBeenCalledWith(JOB_ID, "user-1");
  });

  it("still succeeds when the persistence layer is unavailable", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "user-1" });
    mocks.recordChatJobCancelled.mockResolvedValue(false);

    const response = await POST(cancelRequest({ jobId: JOB_ID }));
    expect(response.status).toBe(200);
  });
});
