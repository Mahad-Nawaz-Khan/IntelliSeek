import { describe, expect, it } from "vitest";

import { createTextStreamSmoother } from "./stream-smoother";

function createFrameHarness() {
  let time = 100;
  let nextId = 1;
  const scheduled = new Map<number, (timestamp: number) => void>();

  return {
    scheduleFrame(callback: (timestamp: number) => void) {
      const id = nextId++;
      scheduled.set(id, callback);
      return id;
    },
    cancelFrame(handle: number) {
      scheduled.delete(handle);
    },
    now() {
      return time;
    },
    pendingCount() {
      return scheduled.size;
    },
    step(ms = 16) {
      time += ms;
      const entries = [...scheduled.entries()];
      scheduled.clear();
      for (const [, callback] of entries) {
        callback(time);
      }
    },
    flushAll(maxSteps = 400, stepMs = 16) {
      let steps = 0;
      while (scheduled.size > 0 && steps < maxSteps) {
        this.step(stepMs);
        steps += 1;
      }
      return steps;
    },
  };
}

describe("createTextStreamSmoother", () => {
  it("progressively reveals a single large burst across multiple frames instead of all at once", async () => {
    const harness = createFrameHarness();
    const updates: string[] = [];
    const completed: string[] = [];

    const smoother = createTextStreamSmoother({
      onUpdate: (text) => updates.push(text),
      onComplete: (text) => completed.push(text),
      scheduleFrame: harness.scheduleFrame,
      cancelFrame: harness.cancelFrame,
      now: harness.now,
    });

    const fullResponse =
      "Binary search divides a sorted array in half at every step, achieving logarithmic time complexity while keeping constant extra space.";

    smoother.push(fullResponse);
    expect(updates).toEqual([]);

    // First frame should reveal a small prefix, not the entire sentence.
    harness.step(16);
    expect(updates.length).toBe(1);
    expect(updates[0].length).toBeGreaterThan(0);
    expect(updates[0].length).toBeLessThan(fullResponse.length);

    let done = false;
    const waitPromise = smoother.complete(fullResponse).then((res) => {
      done = true;
      return res;
    });

    const frames = harness.flushAll();
    const result = await waitPromise;

    expect(done).toBe(true);
    expect(frames).toBeGreaterThan(3);
    expect(updates.length).toBeGreaterThan(4);
    expect(updates[updates.length - 1]).toBe(fullResponse);
    expect(completed).toEqual([fullResponse]);
    expect(result).toEqual({ completed: true, text: fullResponse });
  });

  it("reveals static complete() payloads progressively even when no deltas preceded them", async () => {
    const harness = createFrameHarness();
    const updates: string[] = [];

    const smoother = createTextStreamSmoother({
      onUpdate: (text) => updates.push(text),
      scheduleFrame: harness.scheduleFrame,
      cancelFrame: harness.cancelFrame,
      now: harness.now,
    });

    const staticAnswer =
      "Knowledge base context is disabled, and no relevant passages were found in your uploaded documents.";

    const waitPromise = smoother.complete(staticAnswer);
    expect(updates).toEqual([]);

    harness.step(16);
    expect(updates.length).toBe(1);
    expect(updates[0].length).toBeLessThan(staticAnswer.length);

    harness.flushAll();
    const result = await waitPromise;

    expect(updates.length).toBeGreaterThan(2);
    expect(result).toEqual({ completed: true, text: staticAnswer });
  });

  it("resets partial output cleanly on provider fallback reset", async () => {
    const harness = createFrameHarness();
    const updates: string[] = [];

    const smoother = createTextStreamSmoother({
      onUpdate: (text) => updates.push(text),
      scheduleFrame: harness.scheduleFrame,
      cancelFrame: harness.cancelFrame,
      now: harness.now,
    });

    smoother.push("Partial primary output before failure");
    harness.step(16);
    expect(smoother.getRevealedText().length).toBeGreaterThan(0);

    smoother.reset();
    expect(smoother.getRevealedText()).toBe("");
    expect(smoother.getTargetText()).toBe("");
    expect(updates[updates.length - 1]).toBe("");

    const fallbackText = "Recovered fallback response.";
    smoother.push(fallbackText);
    const waitPromise = smoother.complete(fallbackText);
    harness.flushAll();

    const result = await waitPromise;
    expect(result).toEqual({ completed: true, text: fallbackText });
    expect(smoother.getRevealedText()).toBe(fallbackText);
  });

  it("freezes at the currently visible prefix when stopped and cancels scheduled frames", async () => {
    const harness = createFrameHarness();
    const updates: string[] = [];
    let completeCalls = 0;

    const smoother = createTextStreamSmoother({
      onUpdate: (text) => updates.push(text),
      onComplete: () => {
        completeCalls += 1;
      },
      scheduleFrame: harness.scheduleFrame,
      cancelFrame: harness.cancelFrame,
      now: harness.now,
    });

    const text = "First portion revealed smoothly. Second portion must remain hidden when stopped by the user.";
    smoother.push(text);
    harness.step(16);
    harness.step(16);

    const waitPromise = smoother.complete(text);
    const stoppedAt = smoother.stop();
    const result = await waitPromise;

    expect(stoppedAt.length).toBeGreaterThan(0);
    expect(stoppedAt.length).toBeLessThan(text.length);
    expect(harness.pendingCount()).toBe(0);
    expect(completeCalls).toBe(0);
    expect(result).toEqual({ completed: false, text: stoppedAt });

    // Further pushes after stop are ignored.
    const countBefore = updates.length;
    smoother.push(" more text");
    expect(updates.length).toBe(countBefore);
  });

  it("never splits UTF-16 surrogate pairs across frame boundaries", async () => {
    const harness = createFrameHarness();
    const updates: string[] = [];

    const smoother = createTextStreamSmoother({
      onUpdate: (text) => updates.push(text),
      scheduleFrame: harness.scheduleFrame,
      cancelFrame: harness.cancelFrame,
      now: harness.now,
    });

    const emojiText = "A 🚀 rocket \uD83E\uDDE0 brain 🧪 lab 📘 book check.";
    smoother.push(emojiText);
    const waitPromise = smoother.complete(emojiText);
    harness.flushAll();
    await waitPromise;

    for (const snapshot of updates) {
      // Every revealed slice must keep surrogate pairs intact (no trailing lone high surrogate).
      if (snapshot.length > 0) {
        const lastCode = snapshot.charCodeAt(snapshot.length - 1);
        expect(lastCode < 0xd800 || lastCode > 0xdbff).toBe(true);
      }
    }
    expect(updates[updates.length - 1]).toBe(emojiText);
  });

  it("normalizes trimmed finalText cleanly when server trims leading or trailing whitespace", async () => {
    const harness = createFrameHarness();
    const updates: string[] = [];

    const smoother = createTextStreamSmoother({
      onUpdate: (text) => updates.push(text),
      scheduleFrame: harness.scheduleFrame,
      cancelFrame: harness.cancelFrame,
      now: harness.now,
    });

    smoother.push("   Hello world from deltas.\n\n");
    harness.step(16);
    const waitPromise = smoother.complete("Hello world from deltas.");
    harness.flushAll();
    const result = await waitPromise;

    expect(result).toEqual({ completed: true, text: "Hello world from deltas." });
    expect(updates[updates.length - 1]).toBe("Hello world from deltas.");
  });

  it("jumps immediately when prefersReducedMotion is enabled", async () => {
    const harness = createFrameHarness();
    const updates: string[] = [];

    const smoother = createTextStreamSmoother({
      onUpdate: (text) => updates.push(text),
      scheduleFrame: harness.scheduleFrame,
      cancelFrame: harness.cancelFrame,
      now: harness.now,
      prefersReducedMotion: true,
    });

    smoother.push("Immediate ");
    expect(updates).toEqual(["Immediate "]);
    expect(harness.pendingCount()).toBe(0);

    const result = await smoother.complete("Immediate delivery");
    expect(result).toEqual({ completed: true, text: "Immediate delivery" });
    expect(updates[updates.length - 1]).toBe("Immediate delivery");
  });
});
