import { describe, expect, it } from "vitest";

import { consumeSseReader, parseSseFrame, type StreamEvent } from "./chat-api";

function makeChunkedReader(chunks: string[]): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return stream.getReader();
}

describe("chat-api SSE parsing", () => {
  it("ignores SSE keepalive comments and parses CRLF-delimited frames", async () => {
    const events: StreamEvent[] = [];
    const reader = makeChunkedReader([
      ": stream-open\r\n\r\nevent: job\r\ndata: {\"jobId\":\"job-1\"}\r\n\r\n",
      "event: delta\r\ndata: {\"text\":\"Hello \"}\r\n\r\n",
      "event: done\ndata: {\"answer\":\"Hello!\",\"sources\":[]}\n\n",
    ]);

    await consumeSseReader(reader, (event) => {
      events.push(event);
    });

    expect(events).toEqual([
      { event: "job", data: { jobId: "job-1" } },
      { event: "delta", data: { text: "Hello " } },
      { event: "done", data: { answer: "Hello!", sources: [] } },
    ]);
  });

  it("ignores comment-only frames and malformed JSON payloads", () => {
    expect(parseSseFrame(": heartbeat")).toBeNull();
    expect(parseSseFrame("event: delta\ndata: {bad json")).toBeNull();
    expect(parseSseFrame("event: delta\r\ndata:{\"text\":\"ok\"}")).toEqual({
      event: "delta",
      data: { text: "ok" },
    });
  });
});
