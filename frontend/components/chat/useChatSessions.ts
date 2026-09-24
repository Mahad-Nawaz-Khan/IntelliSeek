"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import {
  deleteChatSession,
  fetchChatSessionMessages,
  fetchChatSessions,
  renameChatSession,
  type ChatMessage as ChatMessageType,
  type ChatSessionSummary,
} from "../../lib/chat-api";

type UseChatSessionsParams = {
  demo: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  sessionParam: string | null;
  router: AppRouterInstance;
  isLoading: boolean;
  onSessionLoaded: (messages: ChatMessageType[]) => void;
  onClearMessages: () => void;
};

export function useChatSessions({
  demo,
  isLoaded,
  isSignedIn,
  sessionParam,
  router,
  isLoading,
  onSessionLoaded,
  onClearMessages,
}: UseChatSessionsParams) {
  const [recentSessionRows, setRecentSessionRows] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const activeSessionIdRef = useRef<string | null>(null);
  const loadedSessionRef = useRef<string | null>(null);
  const isLoadingSessionRef = useRef(false);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    isLoadingSessionRef.current = isLoadingSession;
  }, [isLoadingSession]);

  const refreshRecentChats = useCallback(async () => {
    try {
      setRecentSessionRows(await fetchChatSessions());
    } catch {
      setRecentSessionRows([]);
    }
  }, []);

  useEffect(() => {
    if (demo) return;
    if (!isLoaded || !isSignedIn) {
      setRecentSessionRows([]);
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      loadedSessionRef.current = null;
      return;
    }
    refreshRecentChats();
  }, [demo, isLoaded, isSignedIn, refreshRecentChats]);

  useEffect(() => {
    if (demo || !isLoaded || !isSignedIn) return;

    const sessionId = sessionParam;
    if (!sessionId) {
      setActiveSessionId(null);
      activeSessionIdRef.current = null;
      loadedSessionRef.current = null;
      setIsLoadingSession(false);
      isLoadingSessionRef.current = false;
      return;
    }

    if (sessionId === loadedSessionRef.current) return;

    const requestedSessionId = sessionId;
    let active = true;
    const abortController = new AbortController();
    const timeout = window.setTimeout(() => abortController.abort(), 15000);
    setIsLoadingSession(true);
    isLoadingSessionRef.current = true;

    async function loadSession() {
      try {
        const result = await fetchChatSessionMessages(requestedSessionId, abortController.signal);
        if (!active) return;
        loadedSessionRef.current = result.session.id;
        setActiveSessionId(result.session.id);
        activeSessionIdRef.current = result.session.id;
        onSessionLoaded(result.messages);
        setIsLoadingSession(false);
        isLoadingSessionRef.current = false;
        refreshRecentChats().catch(() => {});
      } catch {
        if (!active) return;
        setActiveSessionId(null);
        activeSessionIdRef.current = null;
        onClearMessages();
        loadedSessionRef.current = null;
        window.history.replaceState(null, "", "/chat");
      } finally {
        window.clearTimeout(timeout);
        if (active) {
          setIsLoadingSession(false);
          isLoadingSessionRef.current = false;
        }
      }
    }

    loadSession();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      abortController.abort();
    };
  }, [demo, isLoaded, isSignedIn, onClearMessages, onSessionLoaded, refreshRecentChats, sessionParam]);

  const handleOpenSession = useCallback(
    (sessionId: string) => {
      if (isLoading || demo) return;
      router.push(`/chat?session=${encodeURIComponent(sessionId)}`);
    },
    [demo, isLoading, router],
  );

  const handleRenameSession = useCallback(
    async (sessionId: string, title: string) => {
      if (demo) return false;
      try {
        const updated = await renameChatSession(sessionId, title);
        setRecentSessionRows((current) =>
          current.map((session) => (session.id === sessionId ? { ...session, title: updated.title } : session)),
        );
        return true;
      } catch {
        return false;
      }
    },
    [demo],
  );

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (deletingSessionId || demo) return;

      setDeletingSessionId(sessionId);
      try {
        await deleteChatSession(sessionId);
        setRecentSessionRows((current) => current.filter((session) => session.id !== sessionId));
        if (sessionId === activeSessionId) {
          setActiveSessionId(null);
          activeSessionIdRef.current = null;
          onClearMessages();
          loadedSessionRef.current = null;
          router.push("/chat");
        }
        await refreshRecentChats();
      } catch {
      } finally {
        setDeletingSessionId(null);
      }
    },
    [activeSessionId, demo, deletingSessionId, onClearMessages, refreshRecentChats, router],
  );

  return {
    recentSessionRows,
    setRecentSessionRows,
    activeSessionId,
    setActiveSessionId,
    activeSessionIdRef,
    loadedSessionRef,
    isLoadingSession,
    setIsLoadingSession,
    isLoadingSessionRef,
    deletingSessionId,
    refreshRecentChats,
    handleOpenSession,
    handleRenameSession,
    handleDeleteSession,
  };
}
