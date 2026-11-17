export const SCROLL_TO_BOTTOM_MIN_DISTANCE_PX = 120;
export const SCROLL_DOWN_TRIGGER_PX = 8;
export const SCROLL_IDLE_HIDE_DELAY_MS = 1200;
export const PROGRAMMATIC_SCROLL_GRACE_MS = 750;

const DIRECTION_JITTER_PX = 1;
const REPIN_BOTTOM_DISTANCE_PX = 24;
const UNPIN_BOTTOM_DISTANCE_PX = 2;

export type ScrollTrackingState = {
  isPinnedToBottom: boolean;
  lastScrollTop: number;
  downwardScrollDistance: number;
  isProgrammaticScrollToBottom: boolean;
};

export type ScrollMetrics = {
  currentTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export type ScrollTransitionAction = "show" | "hide" | "none";

export type ScrollTransitionResult = {
  nextState: ScrollTrackingState;
  action: ScrollTransitionAction;
};

export function createInitialScrollState(): ScrollTrackingState {
  return {
    isPinnedToBottom: true,
    lastScrollTop: 0,
    downwardScrollDistance: 0,
    isProgrammaticScrollToBottom: false,
  };
}

export function getDistanceFromBottom(metrics: ScrollMetrics): number {
  return Math.max(0, metrics.scrollHeight - metrics.currentTop - metrics.clientHeight);
}

/**
 * Resolves how the scroll-to-bottom control should respond to a scroll event.
 * The button only appears during deliberate downward movement well above the bottom,
 * never when scrolling upward, near the bottom, or remaining stationary.
 */
export function evaluateScrollTransition(
  state: ScrollTrackingState,
  metrics: ScrollMetrics,
): ScrollTransitionResult {
  const distanceFromBottom = getDistanceFromBottom(metrics);
  const delta = metrics.currentTop - state.lastScrollTop;

  if (delta < -DIRECTION_JITTER_PX) {
    return {
      nextState: {
        isPinnedToBottom: distanceFromBottom > UNPIN_BOTTOM_DISTANCE_PX ? false : state.isPinnedToBottom,
        lastScrollTop: metrics.currentTop,
        downwardScrollDistance: 0,
        isProgrammaticScrollToBottom: false,
      },
      action: "hide",
    };
  }

  if (delta <= DIRECTION_JITTER_PX) {
    const reachedBottom = distanceFromBottom <= REPIN_BOTTOM_DISTANCE_PX;
    const isNearBottom = distanceFromBottom <= SCROLL_TO_BOTTOM_MIN_DISTANCE_PX;
    return {
      nextState: {
        isPinnedToBottom: reachedBottom ? true : state.isPinnedToBottom,
        lastScrollTop: metrics.currentTop,
        downwardScrollDistance: isNearBottom ? 0 : state.downwardScrollDistance,
        isProgrammaticScrollToBottom: reachedBottom ? false : state.isProgrammaticScrollToBottom,
      },
      action: isNearBottom ? "hide" : "none",
    };
  }

  if (distanceFromBottom <= REPIN_BOTTOM_DISTANCE_PX) {
    return {
      nextState: {
        isPinnedToBottom: true,
        lastScrollTop: metrics.currentTop,
        downwardScrollDistance: 0,
        isProgrammaticScrollToBottom: false,
      },
      action: "hide",
    };
  }

  if (state.isProgrammaticScrollToBottom) {
    return {
      nextState: {
        ...state,
        lastScrollTop: metrics.currentTop,
        downwardScrollDistance: 0,
      },
      action: "hide",
    };
  }

  if (distanceFromBottom <= SCROLL_TO_BOTTOM_MIN_DISTANCE_PX) {
    return {
      nextState: {
        ...state,
        lastScrollTop: metrics.currentTop,
        downwardScrollDistance: 0,
      },
      action: "hide",
    };
  }

  const nextDownwardDistance = state.downwardScrollDistance + delta;
  return {
    nextState: {
      ...state,
      lastScrollTop: metrics.currentTop,
      downwardScrollDistance: nextDownwardDistance,
    },
    action: nextDownwardDistance >= SCROLL_DOWN_TRIGGER_PX ? "show" : "none",
  };
}
