import { describe, expect, it } from "vitest";

import {
  createInitialScrollState,
  evaluateScrollTransition,
  SCROLL_DOWN_TRIGGER_PX,
} from "./chat-scroll";

const CONTAINER_HEIGHT = 800;
const SCROLL_HEIGHT = 2400;

describe("chat-scroll", () => {
  it("stays hidden while scrolling upward even when far from the bottom", () => {
    let state = {
      ...createInitialScrollState(),
      lastScrollTop: 1500,
    };

    const step1 = evaluateScrollTransition(state, {
      currentTop: 1200,
      scrollHeight: SCROLL_HEIGHT,
      clientHeight: CONTAINER_HEIGHT,
    });
    expect(step1.action).toBe("hide");
    expect(step1.nextState.isPinnedToBottom).toBe(false);
    expect(step1.nextState.downwardScrollDistance).toBe(0);

    state = step1.nextState;
    const step2 = evaluateScrollTransition(state, {
      currentTop: 900,
      scrollHeight: SCROLL_HEIGHT,
      clientHeight: CONTAINER_HEIGHT,
    });
    expect(step2.action).toBe("hide");
    expect(step2.nextState.downwardScrollDistance).toBe(0);
  });

  it("reveals only after deliberate downward scrolling well above the bottom", () => {
    const startState = {
      ...createInitialScrollState(),
      isPinnedToBottom: false,
      lastScrollTop: 400,
    };

    // Sub-threshold downward movement must not trigger immediately
    const smallStep = evaluateScrollTransition(startState, {
      currentTop: 404,
      scrollHeight: SCROLL_HEIGHT,
      clientHeight: CONTAINER_HEIGHT,
    });
    expect(smallStep.action).toBe("none");
    expect(smallStep.nextState.downwardScrollDistance).toBe(4);

    // Crossing the threshold triggers showing the button
    const nextStep = evaluateScrollTransition(smallStep.nextState, {
      currentTop: 400 + SCROLL_DOWN_TRIGGER_PX + 2,
      scrollHeight: SCROLL_HEIGHT,
      clientHeight: CONTAINER_HEIGHT,
    });
    expect(nextStep.action).toBe("show");
  });

  it("ignores stationary 1px layout jitter far above the bottom", () => {
    const startState = {
      ...createInitialScrollState(),
      isPinnedToBottom: false,
      lastScrollTop: 500,
    };

    const jitter = evaluateScrollTransition(startState, {
      currentTop: 501,
      scrollHeight: SCROLL_HEIGHT,
      clientHeight: CONTAINER_HEIGHT,
    });
    expect(jitter.action).toBe("none");
    expect(jitter.nextState.downwardScrollDistance).toBe(0);
  });

  it("hides immediately when reversing upward after scrolling down", () => {
    const scrollingDown = evaluateScrollTransition(
      {
        ...createInitialScrollState(),
        isPinnedToBottom: false,
        lastScrollTop: 400,
      },
      {
        currentTop: 500,
        scrollHeight: SCROLL_HEIGHT,
        clientHeight: CONTAINER_HEIGHT,
      },
    );
    expect(scrollingDown.action).toBe("show");

    const reverseUp = evaluateScrollTransition(scrollingDown.nextState, {
      currentTop: 480,
      scrollHeight: SCROLL_HEIGHT,
      clientHeight: CONTAINER_HEIGHT,
    });
    expect(reverseUp.action).toBe("hide");
    expect(reverseUp.nextState.downwardScrollDistance).toBe(0);
  });

  it("hides when scrolling down near the bottom (within 120px)", () => {
    const nearBottom = evaluateScrollTransition(
      {
        ...createInitialScrollState(),
        isPinnedToBottom: false,
        lastScrollTop: 1450,
      },
      {
        currentTop: 1500,
        scrollHeight: SCROLL_HEIGHT,
        clientHeight: CONTAINER_HEIGHT,
      },
    );
    expect(nearBottom.action).toBe("hide");
    expect(nearBottom.nextState.downwardScrollDistance).toBe(0);
  });

  it("suppresses re-appearing during programmatic smooth scroll to the bottom", () => {
    const midSmoothScroll = evaluateScrollTransition(
      {
        isPinnedToBottom: true,
        lastScrollTop: 400,
        downwardScrollDistance: 0,
        isProgrammaticScrollToBottom: true,
      },
      {
        currentTop: 700,
        scrollHeight: SCROLL_HEIGHT,
        clientHeight: CONTAINER_HEIGHT,
      },
    );
    expect(midSmoothScroll.action).toBe("hide");
    expect(midSmoothScroll.nextState.isProgrammaticScrollToBottom).toBe(true);

    const arrivedAtBottom = evaluateScrollTransition(midSmoothScroll.nextState, {
      currentTop: 1590,
      scrollHeight: SCROLL_HEIGHT,
      clientHeight: CONTAINER_HEIGHT,
    });
    expect(arrivedAtBottom.action).toBe("hide");
    expect(arrivedAtBottom.nextState.isProgrammaticScrollToBottom).toBe(false);
    expect(arrivedAtBottom.nextState.isPinnedToBottom).toBe(true);
  });
});
