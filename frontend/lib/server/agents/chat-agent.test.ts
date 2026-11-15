import { beforeEach, describe, expect, it, vi } from "vitest";
import { RunContext } from "@openai/agents";

type AgentConfig = {
  name: string;
  instructions: string;
  model: string;
  tools?: Array<{ name: string; type?: string }>;
};

const {
  agentConfigs,
  runMock,
  setDefaultOpenAIClientMock,
  setOpenAIAPIMock,
  streamGroqGroundedAnswerMock,
  streamGroqGeneralAnswerMock,
} = vi.hoisted(() => ({
  agentConfigs: [] as AgentConfig[],
  runMock: vi.fn(),
  setDefaultOpenAIClientMock: vi.fn(),
  setOpenAIAPIMock: vi.fn(),
  streamGroqGroundedAnswerMock: vi.fn(async function* () {
    yield "Groq grounded fallback";
    return "Groq grounded fallback";
  }),
  streamGroqGeneralAnswerMock: vi.fn(async function* () {
    yield "Groq general fallback";
    return "Groq general fallback";
  }),
}));

vi.mock("@openai/agents", async () => {
  const actual = await vi.importActual<typeof import("@openai/agents")>("@openai/agents");
  return {
    ...actual,
    Agent: class MockAgent {
      config: AgentConfig;
      constructor(config: AgentConfig) {
        this.config = config;
        agentConfigs.push(config);
      }
    },
    run: runMock,
    setDefaultOpenAIClient: setDefaultOpenAIClientMock,
    setOpenAIAPI: setOpenAIAPIMock,
  };
});

vi.mock("../env", () => ({
  getServerEnv: vi.fn((name: string) => {
    if (name === "OPENROUTER_API_KEY") return "or-test-key";
    if (name === "OPENROUTER_CHAT_MODEL") return "thinkingmachines/inkling-2-small:free";
    return null;
  }),
}));

vi.mock("../groq", () => ({
  streamGroqGroundedAnswer: streamGroqGroundedAnswerMock,
  streamGroqGeneralAnswer: streamGroqGeneralAnswerMock,
}));

import {
  createPreRetrievedAgentTools,
  streamAgentAnswer,
  streamGeneralAgentAnswer,
  streamGroundedAgentAnswer,
  type AgentAnswerStreamEvent,
} from "./chat-agent";
import type { RetrievedContext } from "../rag/retriever";
import type { RequestLogger } from "../logger";

const DOC_1_ID = "11111111-1111-4111-8111-111111111111";
const DOC_2_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "0b7f9c1e-6f2a-4c3d-9a1b-2f8e7d6c5b4a";

const SAMPLE_CONTEXT: RetrievedContext[] = [
  {
    chunk_id: "chunk-1",
    document_id: DOC_1_ID,
    filename: "trees-notes.pdf",
    text_content: "A binary search tree keeps left children smaller and right children larger.",
    chunk_index: 0,
    score: 0.91,
  },
  {
    chunk_id: "chunk-2",
    document_id: DOC_1_ID,
    filename: "trees-notes.pdf",
    text_content: "AVL trees maintain balance using rotations after insertions.",
    chunk_index: 2,
    score: 0.84,
  },
  {
    chunk_id: "chunk-3",
    document_id: DOC_2_ID,
    filename: "graphs-slides.pdf",
    text_content: "Dijkstra's algorithm computes shortest paths in weighted graphs.",
    chunk_index: 1,
    score: 0.78,
  },
];

function createMockStream(text: string) {
  const events = [
    {
      type: "raw_model_stream_event",
      data: { type: "output_text_delta", delta: text },
    },
  ];
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
    completed: Promise.resolve(),
    finalOutput: text,
  };
}

async function collectEvents(generator: AsyncGenerator<AgentAnswerStreamEvent>) {
  const collected: AgentAnswerStreamEvent[] = [];
  for await (const event of generator) {
    collected.push(event);
  }
  return collected;
}

describe("chat-agent harness configuration", () => {
  beforeEach(() => {
    agentConfigs.length = 0;
    runMock.mockReset();
    setDefaultOpenAIClientMock.mockClear();
    setOpenAIAPIMock.mockClear();
    streamGroqGroundedAnswerMock.mockClear();
    streamGroqGeneralAnswerMock.mockClear();
  });

  it("equips streamGroundedAgentAnswer with all 3 tools and multi-turn streaming", async () => {
    runMock.mockResolvedValueOnce(createMockStream("Binary search trees store ordered keys [trees-notes.pdf]."));

    const events = await collectEvents(
      streamGroundedAgentAnswer("What is a BST?", SAMPLE_CONTEXT),
    );

    expect(agentConfigs).toHaveLength(1);
    const toolNames = (agentConfigs[0].tools ?? []).map((t) => t.name);
    expect(toolNames).toEqual(["search_chunks", "find_documents", "get_document_chunks"]);

    expect(runMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("What is a BST?"),
      { maxTurns: 6, stream: true },
    );
    expect(events.at(-1)).toMatchObject({
      type: "done",
      answer: "Binary search trees store ordered keys [trees-notes.pdf].",
    });
  });

  it("equips streamGeneralAgentAnswer with all 3 tools and multi-turn streaming", async () => {
    runMock.mockResolvedValueOnce(createMockStream("Recursion solves problems by reducing to base cases."));

    const events = await collectEvents(
      streamGeneralAgentAnswer("What is recursion?"),
    );

    expect(agentConfigs).toHaveLength(1);
    const toolNames = (agentConfigs[0].tools ?? []).map((t) => t.name);
    expect(toolNames).toEqual(["search_chunks", "find_documents", "get_document_chunks"]);

    expect(runMock).toHaveBeenCalledWith(
      expect.anything(),
      "What is recursion?",
      { maxTurns: 6, stream: true },
    );
    expect(events.at(-1)).toEqual({
      type: "done",
      answer: "Recursion solves problems by reducing to base cases.",
      sources: [],
    });
  });

  it("falls back to Groq when streamAgentAnswer primary fails", async () => {
    const warnMock = vi.fn();
    const log = { info: vi.fn(), warn: warnMock, error: vi.fn() } as unknown as RequestLogger;
    runMock.mockRejectedValueOnce(new Error("403 only available on agentic harnesses"));

    const events = await collectEvents(
      streamAgentAnswer("Summarize my uploaded notes", USER_ID, [], { includeKnowledgeBase: true }, log),
    );

    expect(warnMock).toHaveBeenCalledWith(
      "agent.primary.failed",
      expect.objectContaining({ errorCategory: "unknown", emittedDelta: false }),
    );
    expect(streamGroqGeneralAnswerMock).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      { type: "delta", text: "Groq general fallback" },
      { type: "done", answer: "Groq general fallback", sources: [] },
    ]);
  });
});

describe("createPreRetrievedAgentTools", () => {
  it("executes search_chunks, find_documents, and get_document_chunks against pre-retrieved context", async () => {
    const [searchChunks, findDocuments, getDocumentChunks] = createPreRetrievedAgentTools(SAMPLE_CONTEXT);
    const runContext = new RunContext();

    const searchOutput = await searchChunks.invoke(
      runContext,
      JSON.stringify({ query: "binary search tree", limit: 5 }),
    );
    const matchedChunks = JSON.parse(String(searchOutput)) as RetrievedContext[];
    expect(matchedChunks.map((c) => c.chunk_id)).toEqual(["chunk-1", "chunk-2"]);

    const exactSearchOutput = await searchChunks.invoke(
      runContext,
      JSON.stringify({ query: "Dijkstra shortest", limit: 5 }),
    );
    const exactMatches = JSON.parse(String(exactSearchOutput)) as RetrievedContext[];
    expect(exactMatches.map((c) => c.chunk_id)).toEqual(["chunk-3"]);

    const docsOutput = await findDocuments.invoke(
      runContext,
      JSON.stringify({ filename: "trees", limit: 5 }),
    );
    expect(JSON.parse(String(docsOutput))).toEqual([
      { id: DOC_1_ID, filename: "trees-notes.pdf" },
    ]);

    const docChunksOutput = await getDocumentChunks.invoke(
      runContext,
      JSON.stringify({ document_id: DOC_1_ID, limit: 12 }),
    );
    const docChunks = JSON.parse(String(docChunksOutput)) as RetrievedContext[];
    expect(docChunks.map((c) => c.chunk_id)).toEqual(["chunk-1", "chunk-2"]);
  });

  it("returns empty JSON arrays when pre-retrieved context is empty", async () => {
    const [searchChunks, findDocuments, getDocumentChunks] = createPreRetrievedAgentTools([]);
    const runContext = new RunContext();

    expect(
      await searchChunks.invoke(runContext, JSON.stringify({ query: "anything", limit: 5 })),
    ).toBe("[]");
    expect(
      await findDocuments.invoke(runContext, JSON.stringify({ filename: "notes", limit: 5 })),
    ).toBe("[]");
    expect(
      await getDocumentChunks.invoke(runContext, JSON.stringify({ document_id: DOC_1_ID, limit: 12 })),
    ).toBe("[]");
  });
});
