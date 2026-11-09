"use client";

import { Menu, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { useTheme } from "../../context/ThemeContext";
import type { ChatSession, KnowledgeSource, KnowledgeSourceGroup } from "../../lib/ui-state";
import { AppSidebar } from "../sidebar/AppSidebar";

type AcademicWorkspaceProps = {
  children: ReactNode;
  groups: KnowledgeSourceGroup[];
  recentChats: ChatSession[];
  sourceStatus: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  deletingSessionId?: string | null;
  focusedSourceId?: string | null;
  onSelectSource?: (source: KnowledgeSource) => void;
  onDeleteSource?: (sourceId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, title: string) => Promise<boolean>;
  onOpenSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  onOpenUpload?: () => void;
  onOpenKnowledgeBaseUpload?: () => void;
  canManageKnowledgeBase?: boolean;
};

const SIDEBAR_STORAGE_KEY = "intelliseek-sidebar-collapsed";

export function AcademicWorkspace({
  children,
  groups,
  recentChats,
  sourceStatus,
  deletingSourceId,
  deletingSessionId,
  focusedSourceId,
  onSelectSource,
  onDeleteSource,
  onDeleteSession,
  onRenameSession,
  onOpenSession,
  onNewChat,
  onOpenUpload,
  onOpenKnowledgeBaseUpload,
  canManageKnowledgeBase,
}: Readonly<AcademicWorkspaceProps>) {
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const isDark = theme === "dark";

  const handleToggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  return (
    <main className="academic-page-shell h-dvh overflow-hidden text-slate-100">
      <div className="flex h-full items-stretch gap-px bg-white/10">
        <div className="hidden min-h-0 lg:flex lg:shrink-0">
          <AppSidebar
            groups={groups}
            recentChats={recentChats}
            sourceStatus={sourceStatus}
            deletingSourceId={deletingSourceId}
            deletingSessionId={deletingSessionId}
            focusedSourceId={focusedSourceId}
            onSelectSource={onSelectSource}
            onDeleteSource={onDeleteSource}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
            onOpenSession={onOpenSession}
            onNewChat={onNewChat}
            onOpenUpload={onOpenUpload}
            onOpenKnowledgeBaseUpload={onOpenKnowledgeBaseUpload}
            canManageKnowledgeBase={canManageKnowledgeBase}
            isCollapsed={isDesktopSidebarCollapsed}
            onToggleCollapsed={handleToggleDesktopSidebar}
          />
        </div>

        {isSidebarOpen && (
          <div className="fixed inset-0 z-40 bg-slate-950/75 p-3 backdrop-blur-sm lg:hidden">
            <AppSidebar
              groups={groups}
              recentChats={recentChats}
              sourceStatus={sourceStatus}
              deletingSourceId={deletingSourceId}
              deletingSessionId={deletingSessionId}
              focusedSourceId={focusedSourceId}
              onClose={() => setIsSidebarOpen(false)}
              onSelectSource={
                onSelectSource
                  ? (source) => {
                      onSelectSource(source);
                      setIsSidebarOpen(false);
                    }
                  : undefined
              }
              onDeleteSource={onDeleteSource}
              onDeleteSession={onDeleteSession}
              onRenameSession={onRenameSession}
              onOpenSession={(sessionId) => {
                onOpenSession?.(sessionId);
                setIsSidebarOpen(false);
              }}
              onNewChat={() => {
                onNewChat?.();
                setIsSidebarOpen(false);
              }}
              onOpenUpload={() => {
                onOpenUpload?.();
                setIsSidebarOpen(false);
              }}
              onOpenKnowledgeBaseUpload={
                onOpenKnowledgeBaseUpload
                  ? () => {
                      onOpenKnowledgeBaseUpload();
                      setIsSidebarOpen(false);
                    }
                  : undefined
              }
              canManageKnowledgeBase={canManageKnowledgeBase}
            />
          </div>
        )}

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950/55 backdrop-blur-xl">
          <div className="relative flex h-14 items-center justify-center border-b border-white/10 px-3 lg:hidden">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="absolute left-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold tracking-[0.16em] text-cyan-100 uppercase">IntelliSeek</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="absolute right-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
              suppressHydrationWarning
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
