import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "0b7f9c1e-6f2a-4c3d-9a1b-2f8e7d6c5b4a";
const PERSONAL_DOC_ID = "11111111-1111-4111-8111-111111111111";
const KB_DOC_ID = "22222222-2222-4222-8222-222222222222";

type RecordedQueryCall = {
  table: string;
  method: string;
  args: unknown[];
};

type RecordedRpcCall = {
  fn: string;
  params: Record<string, unknown>;
};

const {
  embedTextMock,
  rpcCalls,
  queryCalls,
  rpcResponses,
  fromResponses,
  resetMocks,
} = vi.hoisted(() => {
  const rpcCalls: RecordedRpcCall[] = [];
  const queryCalls: RecordedQueryCall[] = [];
  const rpcResponses = new Map<string, { data: unknown[]; error: unknown }>();
  const fromResponses = new Map<string, { data: unknown[]; error: unknown }>();
  const embedTextMock = vi.fn(async () => [0.1, 0.2, 0.3]);

  const resetMocks = () => {
    rpcCalls.length = 0;
    queryCalls.length = 0;
    rpcResponses.clear();
    fromResponses.clear();
    embedTextMock.mockClear();
  };

  return {
    embedTextMock,
    rpcCalls,
    queryCalls,
    rpcResponses,
    fromResponses,
    resetMocks,
  };
});

function createQueryBuilder(table: string) {
  const builder: Record<string, unknown> = {
    then(onFulfilled: (value: { data: unknown[]; error: unknown }) => unknown) {
      const result = fromResponses.get(table) ?? { data: [], error: null };
      return Promise.resolve(result).then(onFulfilled);
    },
  };

  for (const method of ["select", "eq", "in", "or", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      queryCalls.push({ table, method, args });
      return builder;
    };
  }

  return builder;
}

vi.mock("../supabase", () => ({
  getSupabaseServiceClient: () => ({
    from: (table: string) => createQueryBuilder(table),
    rpc: async (fn: string, params: Record<string, unknown>) => {
      rpcCalls.push({ fn, params });
      return rpcResponses.get(fn) ?? { data: [], error: null };
    },
  }),
}));

vi.mock("./embeddings", () => ({
  embedText: embedTextMock,
}));

import { matchUserChunks, matchUserMicroChunks } from "./vector-store";
import {
  listPersonalIndexedDocumentIds,
  retrieveContext,
  retrieveFullTextContext,
} from "./retriever";

describe("retrieval Knowledge Base scope enforcement", () => {
  beforeEach(() => {
    resetMocks();
  });

  it("queries only indexed personal documents owned by the user in listPersonalIndexedDocumentIds", async () => {
    fromResponses.set("documents", {
      data: [{ id: PERSONAL_DOC_ID }],
      error: null,
    });

    const ids = await listPersonalIndexedDocumentIds(USER_ID);
    expect(ids).toEqual([PERSONAL_DOC_ID]);
    expect(queryCalls).toContainEqual({ table: "documents", method: "eq", args: ["user_id", USER_ID] });
    expect(queryCalls).toContainEqual({ table: "documents", method: "eq", args: ["source_scope", "personal"] });
    expect(queryCalls).toContainEqual({ table: "documents", method: "eq", args: ["processing_status", "indexed"] });
  });

  it("returns empty results immediately from vector RPC helpers when strictDocumentIds is true and empty", async () => {
    const [chunks, microChunks] = await Promise.all([
      matchUserChunks(USER_ID, [0.1, 0.2], 5, undefined, { documentIds: [], strictDocumentIds: true }),
      matchUserMicroChunks(USER_ID, [0.1, 0.2], 5, undefined, { documentIds: [], strictDocumentIds: true }),
    ]);

    expect(chunks).toEqual([]);
    expect(microChunks).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
  });

  it("skips embedding and vector RPCs when Knowledge Base is off and user has no personal documents", async () => {
    fromResponses.set("documents", { data: [], error: null });

    const preResolvedEmpty = await retrieveContext(
      "binary search trees",
      USER_ID,
      6,
      undefined,
      [],
      { includeKnowledgeBase: false, personalDocumentIds: [] },
    );
    const queriedEmpty = await retrieveContext(
      "binary search trees",
      USER_ID,
      6,
      undefined,
      [],
      { includeKnowledgeBase: false },
    );

    expect(preResolvedEmpty).toEqual([]);
    expect(queriedEmpty).toEqual([]);
    expect(embedTextMock).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
  });

  it("restricts semantic vector RPCs and post-filters stray KB chunks when Knowledge Base is off", async () => {
    rpcResponses.set("match_user_chunks", {
      data: [
        {
          chunk_id: "chunk-personal",
          document_id: PERSONAL_DOC_ID,
          filename: "my-notes.pdf",
          text_content: "Personal AVL tree notes.",
          chunk_index: 0,
          similarity: 0.89,
        },
        {
          chunk_id: "chunk-kb",
          document_id: KB_DOC_ID,
          filename: "shared-kb.pdf",
          text_content: "Knowledge Base chunk that must not leak.",
          chunk_index: 0,
          similarity: 0.95,
        },
      ],
      error: null,
    });
    rpcResponses.set("match_user_micro_chunks", {
      data: [],
      error: null,
    });

    const result = await retrieveContext(
      "AVL trees",
      USER_ID,
      6,
      undefined,
      [],
      { includeKnowledgeBase: false, personalDocumentIds: [PERSONAL_DOC_ID] },
    );

    expect(embedTextMock).toHaveBeenCalledTimes(1);
    expect(rpcCalls).toEqual([
      expect.objectContaining({
        fn: "match_user_chunks",
        params: expect.objectContaining({ match_document_ids: [PERSONAL_DOC_ID] }),
      }),
      expect.objectContaining({
        fn: "match_user_micro_chunks",
        params: expect.objectContaining({ match_document_ids: [PERSONAL_DOC_ID] }),
      }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.document_id).toBe(PERSONAL_DOC_ID);
    expect(queryCalls).toContainEqual({
      table: "chunks",
      method: "eq",
      args: ["documents.source_scope", "personal"],
    });
  });

  it("returns empty when a hinted Knowledge Base document is excluded by includeKnowledgeBase=false", async () => {
    const result = await retrieveContext(
      "AVL trees",
      USER_ID,
      6,
      undefined,
      [KB_DOC_ID],
      { includeKnowledgeBase: false, personalDocumentIds: [PERSONAL_DOC_ID] },
    );

    expect(result).toEqual([]);
    expect(embedTextMock).not.toHaveBeenCalled();
    expect(rpcCalls).toHaveLength(0);
  });

  it("intersects hinted documentIds down to personalDocumentIds when Knowledge Base is off", async () => {
    rpcResponses.set("match_user_chunks", { data: [], error: null });
    rpcResponses.set("match_user_micro_chunks", { data: [], error: null });

    await retrieveContext(
      "AVL trees",
      USER_ID,
      6,
      undefined,
      [PERSONAL_DOC_ID, KB_DOC_ID],
      { includeKnowledgeBase: false, personalDocumentIds: [PERSONAL_DOC_ID] },
    );

    expect(rpcCalls).toEqual([
      expect.objectContaining({
        fn: "match_user_chunks",
        params: expect.objectContaining({ match_document_ids: [PERSONAL_DOC_ID] }),
      }),
      expect.objectContaining({
        fn: "match_user_micro_chunks",
        params: expect.objectContaining({ match_document_ids: [PERSONAL_DOC_ID] }),
      }),
    ]);
  });

  it("applies personal document scope in retrieveFullTextContext and skips when empty", async () => {
    const emptyResult = await retrieveFullTextContext(
      "binary search trees",
      USER_ID,
      6,
      undefined,
      [],
      { includeKnowledgeBase: false, personalDocumentIds: [] },
    );
    expect(emptyResult).toEqual([]);
    expect(rpcCalls).toHaveLength(0);

    rpcResponses.set("fulltext_search_chunks", {
      data: [
        {
          chunk_id: "ft-personal",
          document_id: PERSONAL_DOC_ID,
          filename: "my-notes.pdf",
          text_content: "Binary search tree insertion.",
          chunk_index: 1,
          rank: 0.2,
        },
        {
          chunk_id: "ft-kb",
          document_id: KB_DOC_ID,
          filename: "shared-kb.pdf",
          text_content: "Shared KB text.",
          chunk_index: 0,
          rank: 0.3,
        },
      ],
      error: null,
    });

    const scopedResult = await retrieveFullTextContext(
      "binary search trees",
      USER_ID,
      6,
      undefined,
      [],
      { includeKnowledgeBase: false, personalDocumentIds: [PERSONAL_DOC_ID] },
    );

    expect(rpcCalls).toEqual([
      expect.objectContaining({
        fn: "fulltext_search_chunks",
        params: expect.objectContaining({ match_document_ids: [PERSONAL_DOC_ID] }),
      }),
    ]);
    expect(scopedResult).toHaveLength(1);
    expect(scopedResult[0]?.document_id).toBe(PERSONAL_DOC_ID);
  });
});
