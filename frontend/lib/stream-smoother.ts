export type StreamSmootherResult = {
  completed: boolean;
  text: string;
};

export type TextStreamSmootherOptions = {
  onUpdate: (revealedText: string) => void;
  onComplete?: (finalText: string) => void;
  scheduleFrame?: (callback: (timestamp: number) => void) => number;
  cancelFrame?: (handle: number) => void;
  now?: () => number;
  prefersReducedMotion?: boolean;
};

export type TextStreamSmoother = {
  push: (delta: string) => void;
  reset: () => void;
  complete: (finalText?: string) => Promise<StreamSmootherResult>;
  stop: () => string;
  flushNow: () => string;
  getRevealedText: () => string;
  getTargetText: () => string;
  isComplete: () => boolean;
};

const WORD_CHAR_REGEX = /[A-Za-z0-9]/;

function snapRevealIndex(text: string, currentIndex: number, desiredStep: number): number {
  let nextIndex = Math.min(text.length, currentIndex + Math.max(1, desiredStep));
  if (nextIndex >= text.length) return text.length;

  // Complete short ASCII words cleanly when a boundary is just ahead.
  if (WORD_CHAR_REGEX.test(text[nextIndex - 1]) && WORD_CHAR_REGEX.test(text[nextIndex])) {
    const searchLimit = Math.min(text.length, nextIndex + 5);
    for (let i = nextIndex; i < searchLimit; i += 1) {
      if (!WORD_CHAR_REGEX.test(text[i])) {
        nextIndex = i;
        break;
      }
    }
  }

  // Never split a UTF-16 surrogate pair across frames.
  if (nextIndex < text.length) {
    const code = text.charCodeAt(nextIndex);
    if (code >= 0xdc00 && code <= 0xdfff) {
      nextIndex += 1;
    }
  }

  return Math.min(text.length, nextIndex);
}

function commonPrefixLength(a: string, b: string, maxLength: number): number {
  const limit = Math.min(a.length, b.length, maxLength);
  let i = 0;
  while (i < limit && a[i] === b[i]) {
    i += 1;
  }
  return i;
}

/**
 * Smooths bursty or coalesced SSE text deltas into frame-paced progressive updates.
 */
export function createTextStreamSmoother(options: TextStreamSmootherOptions): TextStreamSmoother {
  const getNow =
    options.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));

  const scheduleFrame =
    options.scheduleFrame ??
    (typeof globalThis.requestAnimationFrame === "function"
      ? (cb) => globalThis.requestAnimationFrame(cb)
      : (cb) => Number(globalThis.setTimeout(() => cb(getNow()), 16)));

  const cancelFrame =
    options.cancelFrame ??
    (typeof globalThis.cancelAnimationFrame === "function"
      ? (handle) => globalThis.cancelAnimationFrame(handle)
      : (handle) => globalThis.clearTimeout(handle));

  const reducedMotion = Boolean(options.prefersReducedMotion);

  let targetText = "";
  let revealedLength = 0;
  let creditChars = 0;
  let lastFrameTime: number | null = null;
  let frameHandle: number | null = null;
  let finished = false;
  let completedEmitted = false;
  let stopped = false;
  let lastEmittedText = "";
  const completionWaiters: Array<(result: StreamSmootherResult) => void> = [];

  const clearScheduledFrame = () => {
    if (frameHandle !== null) {
      cancelFrame(frameHandle);
      frameHandle = null;
    }
  };

  const emitUpdateIfChanged = (text: string) => {
    if (text === lastEmittedText) return;
    lastEmittedText = text;
    options.onUpdate(text);
  };

  const resolveWaiters = (result: StreamSmootherResult) => {
    while (completionWaiters.length) {
      const resolve = completionWaiters.shift();
      resolve?.(result);
    }
  };

  const finalizeIfReady = () => {
    if (!finished || stopped || revealedLength < targetText.length) return false;
    clearScheduledFrame();
    lastFrameTime = null;
    emitUpdateIfChanged(targetText);
    if (!completedEmitted) {
      completedEmitted = true;
      options.onComplete?.(targetText);
    }
    resolveWaiters({ completed: true, text: targetText });
    return true;
  };

  const ensureFrameScheduled = () => {
    if (stopped || frameHandle !== null || revealedLength >= targetText.length) return;
    frameHandle = scheduleFrame(tick);
  };

  const tick = (timestamp: number) => {
    frameHandle = null;
    if (stopped) return;

    if (revealedLength >= targetText.length) {
      lastFrameTime = null;
      finalizeIfReady();
      return;
    }

    const currentTime = Number.isFinite(timestamp) ? timestamp : getNow();
    const rawElapsed = lastFrameTime === null ? 16 : currentTime - lastFrameTime;
    const elapsedMs = Math.max(4, Math.min(rawElapsed, 80));
    lastFrameTime = currentTime;

    const backlog = targetText.length - revealedLength;
    const charsPerSec = finished
      ? Math.min(3200, Math.max(240, backlog / 0.5))
      : Math.min(1200, Math.max(180, backlog / 0.75));

    creditChars += (charsPerSec * elapsedMs) / 1000;

    if (creditChars >= 1) {
      const nextIndex = snapRevealIndex(targetText, revealedLength, Math.floor(creditChars));
      const actualStep = nextIndex - revealedLength;
      creditChars = Math.max(-4, creditChars - actualStep);
      revealedLength = nextIndex;
      emitUpdateIfChanged(targetText.slice(0, revealedLength));
    }

    if (revealedLength < targetText.length) {
      ensureFrameScheduled();
    } else {
      lastFrameTime = null;
      finalizeIfReady();
    }
  };

  return {
    push(delta: string) {
      if (stopped || finished || !delta) return;
      targetText += delta;

      if (reducedMotion) {
        revealedLength = targetText.length;
        emitUpdateIfChanged(targetText);
        return;
      }

      ensureFrameScheduled();
    },

    reset() {
      if (stopped) return;
      clearScheduledFrame();
      targetText = "";
      revealedLength = 0;
      creditChars = 0;
      lastFrameTime = null;
      finished = false;
      completedEmitted = false;
      emitUpdateIfChanged("");
    },

    complete(finalText?: string) {
      if (stopped) {
        return Promise.resolve({ completed: false, text: targetText.slice(0, revealedLength) });
      }

      finished = true;

      if (typeof finalText === "string" && finalText !== targetText) {
        const previousTarget = targetText;
        targetText = finalText;
        revealedLength = commonPrefixLength(previousTarget, targetText, revealedLength);
        if (revealedLength > 0 || lastEmittedText !== "") {
          emitUpdateIfChanged(targetText.slice(0, revealedLength));
        }
      }

      if (reducedMotion) {
        clearScheduledFrame();
        revealedLength = targetText.length;
        emitUpdateIfChanged(targetText);
      }

      if (finalizeIfReady()) {
        return Promise.resolve({ completed: true, text: targetText });
      }

      ensureFrameScheduled();
      return new Promise<StreamSmootherResult>((resolve) => {
        completionWaiters.push(resolve);
      });
    },

    stop() {
      if (stopped) return targetText.slice(0, revealedLength);
      stopped = true;
      clearScheduledFrame();
      lastFrameTime = null;
      const visibleText = targetText.slice(0, revealedLength);
      resolveWaiters({ completed: false, text: visibleText });
      return visibleText;
    },

    flushNow() {
      if (stopped) return targetText.slice(0, revealedLength);
      clearScheduledFrame();
      lastFrameTime = null;
      revealedLength = targetText.length;
      emitUpdateIfChanged(targetText);
      finalizeIfReady();
      return targetText;
    },

    getRevealedText() {
      return targetText.slice(0, revealedLength);
    },

    getTargetText() {
      return targetText;
    },

    isComplete() {
      return finished && revealedLength >= targetText.length;
    },
  };
}
