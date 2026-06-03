"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type DemoContextValue = {
  isDemo: boolean;
  questionsUsed: number;
  remaining: number;
  hasReachedLimit: boolean;
  startDemo: () => void;
  endDemo: () => void;
  decrementQuestion: () => boolean;
};

const DEMO_SESSION_KEY = "intelliseek-demo";
const DEMO_LIMIT = 5;

function readStoredState() {
  if (typeof window === "undefined") return { isDemo: false, questionsUsed: 0 };
  try {
    const raw = window.sessionStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return { isDemo: false, questionsUsed: 0 };
    const parsed = JSON.parse(raw) as { isDemo?: boolean; questionsUsed?: number };
    return { isDemo: Boolean(parsed.isDemo), questionsUsed: Math.max(0, Number(parsed.questionsUsed) || 0) };
  } catch {
    return { isDemo: false, questionsUsed: 0 };
  }
}

function writeStoredState(state: { isDemo: boolean; questionsUsed: number }) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(state));
  } catch {}
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ isDemo: boolean; questionsUsed: number }>(() => readStoredState());

  useEffect(() => {
    writeStoredState(state);
  }, [state]);

  const startDemo = useCallback(() => {
    setState({ isDemo: true, questionsUsed: 0 });
  }, []);

  const endDemo = useCallback(() => {
    setState({ isDemo: false, questionsUsed: 0 });
  }, []);

  const decrementQuestion = useCallback(() => {
    let accepted = false;
    setState((current) => {
      if (!current.isDemo || current.questionsUsed >= DEMO_LIMIT) {
        accepted = false;
        return current;
      }
      accepted = true;
      return { ...current, questionsUsed: current.questionsUsed + 1 };
    });
    return accepted;
  }, []);

  const value = useMemo<DemoContextValue>(
    () => ({
      isDemo: state.isDemo,
      questionsUsed: state.questionsUsed,
      remaining: Math.max(0, DEMO_LIMIT - state.questionsUsed),
      hasReachedLimit: state.isDemo && state.questionsUsed >= DEMO_LIMIT,
      startDemo,
      endDemo,
      decrementQuestion,
    }),
    [state, startDemo, endDemo, decrementQuestion],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("useDemo must be used inside DemoProvider");
  return value;
}
