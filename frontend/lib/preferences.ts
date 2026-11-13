"use client";

import { useCallback, useSyncExternalStore } from "react";

export type UserPreferences = {
  citationPreviews: boolean;
  compactMessages: boolean;
  sendOnEnter: boolean;
  autoScrollOnStream: boolean;
  includeKnowledgeBase: boolean;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  citationPreviews: true,
  compactMessages: false,
  sendOnEnter: true,
  autoScrollOnStream: true,
  includeKnowledgeBase: true,
};

const STORAGE_KEY = "intelliseek-preferences-v1";

let cachedRaw: string | null = null;
let cachedSnapshot: UserPreferences = DEFAULT_PREFERENCES;
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach((listener) => listener());
}

function parsePreferences(raw: string | null): UserPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      citationPreviews:
        typeof parsed.citationPreviews === "boolean"
          ? parsed.citationPreviews
          : DEFAULT_PREFERENCES.citationPreviews,
      compactMessages:
        typeof parsed.compactMessages === "boolean"
          ? parsed.compactMessages
          : DEFAULT_PREFERENCES.compactMessages,
      sendOnEnter:
        typeof parsed.sendOnEnter === "boolean"
          ? parsed.sendOnEnter
          : DEFAULT_PREFERENCES.sendOnEnter,
      autoScrollOnStream:
        typeof parsed.autoScrollOnStream === "boolean"
          ? parsed.autoScrollOnStream
          : DEFAULT_PREFERENCES.autoScrollOnStream,
      includeKnowledgeBase:
        typeof parsed.includeKnowledgeBase === "boolean"
          ? parsed.includeKnowledgeBase
          : DEFAULT_PREFERENCES.includeKnowledgeBase,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function getSnapshot(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedSnapshot = parsePreferences(raw);
    }
    return cachedSnapshot;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function getServerSnapshot(): UserPreferences {
  return DEFAULT_PREFERENCES;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedRaw = null;
      emitChange();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }
  return () => {
    listeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function updateUserPreferences(patch: Partial<UserPreferences>): UserPreferences {
  const next: UserPreferences = {
    ...getSnapshot(),
    ...patch,
  };
  if (typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(next);
      window.localStorage.setItem(STORAGE_KEY, serialized);
      cachedRaw = serialized;
      cachedSnapshot = next;
    } catch {
      cachedSnapshot = next;
    }
  }
  emitChange();
  return next;
}

export function resetUserPreferences(): UserPreferences {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors in restricted environments
    }
  }
  cachedRaw = null;
  cachedSnapshot = DEFAULT_PREFERENCES;
  emitChange();
  return DEFAULT_PREFERENCES;
}

export function usePreferences() {
  const preferences = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const updatePreference = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      updateUserPreferences({ [key]: value });
    },
    [],
  );

  const resetPreferences = useCallback(() => {
    resetUserPreferences();
  }, []);

  return {
    preferences,
    updatePreference,
    resetPreferences,
  };
}
