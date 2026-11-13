import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "0b7f9c1e-6f2a-4c3d-9a1b-2f8e7d6c5b4a";
const SESSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PERSONAL_DOC_ID = "11111111-1111-4111-8111-111111111111";

const {
  listPersonalIndexedDocumentIdsMock,
  retrieveContextMock,
  retrieveKeywordContextMock,
  streamGeneralAgentAnswerMock,
} = vi.hoisted(() => ({
  listPersonalIndexedDocumentIdsMock: vi.fn(async () => [PERSONAL_DOC_ID]),
  retrieveContextMock: vi.fn(async () => []),
  retrieveKeywordContextMock: vi.fn(async () => []),
  streamGeneralAgentAnswerMock: vi.fn(async function* () {
    yield { type: "delta", text: "Answer" } as const;
    yield { type: "done", answer: "Answer", sources: [] } as const;
  }),
}));

function createSupabaseQuery(table: string) {
  const builder: Record<string, unknown> = {
    single: async () => ({
      data: { id: SESSION_ID, title: "New chat", title_status: "pending" },
      error: null,
    }),
    then(onFulfilled: (value: { data: unknown; error: unknown }) => unknown) {
      const value = table === "chat_history" ? { data: [], error: null } : { data: null, error: null };
      return Promise.resolve(value).then(onFulfilled);
    },
  };

  for (const method of ["insert", "update", "select", "eq", "order", "limit"]) {
    builder[method] = () => builder;
  }

  return builder;
}

vi.mock("next/server", () => ({
  after: vi.fn(),
}));

vi.mock("./server/auth", () => ({
  getAuthenticatedUser: vi.fn(async () => ({ id: USER_ID, email: "student@example.com" })),
}));

vi.mock("./server/rate-limit", () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, limit: 20, remaining: 19, resetAt: Date.now() + 60_000 })),
  getClientIp: () => "127.0.0.1",
  rateLimitHeaders: () => ({}),
  rateLimitResponse: vi.fn(() => new Response(null, { status: 429 })),
}));

vi.mock("./server/supabase", () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => createSupabaseQuery(table),
  }),
}));

vi.mock("./server/chat-jobs", () => ({
  forgetChatJobCancelled: vi.fn(),
  forgetChatJobCancelledInDb: vi.fn(async () => {}),
  isChatJobCancelledInDb: vi.fn(async () => false),
  isChatJobCancelledInMemory: vi.fn(() => false),
}));

vi.mock("./server/client-errors", () => ({
  toClientErrorMessage: vi.fn(() => "Something went wrong"),
}));

vi.mock("./server/groq", () => ({
  generateGroqChatTitle: vi.fn(async () => "Test Question"),
}));

vi.mock("./source-citations", () => ({
  normalizeSourceCitations: vi.fn((sources: unknown[]) => sources),
}));

vi.mock("./server/agents/chat-agent", () => ({
  streamAgentAnswer: vi.fn(),
  streamGeneralAgentAnswer: streamGeneralAgentAnswerMock,
  streamGroundedAgentAnswer: vi.fn(),
}));

vi.mock("./server/rag/retriever", () => ({
  filterRelevantContext: vi.fn((items: unknown[]) => items),
  hasIndexedDocuments: vi.fn(async () => false),
  isDocumentSummaryRequest: vi.fn(() => false),
  listPersonalIndexedDocumentIds: listPersonalIndexedDocumentIdsMock,
  mergeRetrievedContext: vi.fn((a: unknown[], b: unknown[]) => [...a, ...b]),
  retrieveContext: retrieveContextMock,
  retrieveContextFromDocumentIds: vi.fn(async () => []),
  retrieveDocumentContextByIds: vi.fn(async () => []),
  retrieveKeywordContext: retrieveKeywordContextMock,
  retrieveRepresentativeDocumentContext: vi.fn(async () => []),
  validateQuestion: vi.fn((value: string) => value.trim()),
}));

import { POST } from "../app/api/chat/route";

function createChatRequest(body: unknown) {
  return new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat includeKnowledgeBase validation and scoping", () => {
  beforeEach(() => {
    listPersonalIndexedDocumentIdsMock.mockClear();
    retrieveContextMock.mockClear();
    retrieveKeywordContextMock.mockClear();
    streamGeneralAgentAnswerMock.mockClear();
  });

  it("rejects non-boolean includeKnowledgeBase values with HTTP 400", async () => {
    for (const invalidFlag of ["false", 0, null, {}]) {
      const response = await POST(
        createChatRequest({
          question: "What is recursion?",
          includeKnowledgeBase: invalidFlag,
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        error: "Invalid knowledge base availability flag",
      });
    }
  });

  it("pre-resolves personal document IDs and forwards includeKnowledgeBase=false when disabled", async () => {
    const response = await POST(
      createChatRequest({
        question: "Explain recursion",
        includeKnowledgeBase: false,
      }),
    );

    expect(response.status).toBe(200);
    await response.text();

    expect(listPersonalIndexedDocumentIdsMock).toHaveBeenCalledTimes(1);
    expect(retrieveContextMock).toHaveBeenCalledWith(
      "Explain recursion",
      USER_ID,
      10,
      expect.anything(),
      [],
      { includeKnowledgeBase: false, personalDocumentIds: [PERSONAL_DOC_ID] },
    );
    expect(retrieveKeywordContextMock).toHaveBeenCalledWith(
      "Explain recursion",
      USER_ID,
      8,
      expect.anything(),
      [],
      { includeKnowledgeBase: false, personalDocumentIds: [PERSONAL_DOC_ID] },
    );
    expect(streamGeneralAgentAnswerMock).toHaveBeenCalledWith(
      "Explain recursion",
      [],
      expect.anything(),
      { includeKnowledgeBase: false },
    );
  });

  it("defaults includeKnowledgeBase to true without pre-resolving personal-only document IDs", async () => {
    const response = await POST(
      createChatRequest({
        question: "Explain recursion",
      }),
    );

    expect(response.status).toBe(200);
    await response.text();

    expect(listPersonalIndexedDocumentIdsMock).not.toHaveBeenCalled();
    expect(retrieveContextMock).toHaveBeenCalledWith(
      "Explain recursion",
      USER_ID,
      10,
      expect.anything(),
      [],
      { includeKnowledgeBase: true, personalDocumentIds: undefined },
    );
  });
});
