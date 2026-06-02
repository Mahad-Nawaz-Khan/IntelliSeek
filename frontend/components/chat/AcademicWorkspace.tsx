"use client";

import { Menu, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { useTheme } from "../../context/ThemeContext";
import type { ChatSession, KnowledgeSourceGroup } from "../../lib/ui-state";
import { AppSidebar } from "../sidebar/AppSidebar";

type AcademicWorkspaceProps = {
  children: ReactNode;
  groups: KnowledgeSourceGroup[];
  recentChats: ChatSession[];
  sourceStatus: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  deletingSessionId?: string | null;
  onDeleteSource?: (sourceId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onOpenSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  onOpenUpload?: () => void;
  onOpenKnowledgeBaseUpload?: () => void;
  canManageKnowledgeBase?: boolean;
};

export function AcademicWorkspace({
  children,
  groups,
  recentChats,
  sourceStatus,
  deletingSourceId,
  deletingSessionId,
  onDeleteSource,
  onDeleteSession,
  onOpenSession,
  onNewChat,
  onOpenUpload,
  onOpenKnowledgeBaseUpload,
  canManageKnowledgeBase,
}: AcademicWorkspaceProps) {
  const { theme, toggleTheme } = useTheme();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);
  const isDark = theme === "dark";

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
            onDeleteSource={onDeleteSource}
            onDeleteSession={onDeleteSession}
            onOpenSession={onOpenSession}
            onNewChat={onNewChat}
            onOpenUpload={onOpenUpload}
            onOpenKnowledgeBaseUpload={onOpenKnowledgeBaseUpload}
            canManageKnowledgeBase={canManageKnowledgeBase}
            isCollapsed={isDesktopSidebarCollapsed}
            onToggleCollapsed={() => setIsDesktopSidebarCollapsed((v) => !v)}
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
              onClose={() => setIsSidebarOpen(false)}
              onDeleteSource={onDeleteSource}
              onDeleteSession={onDeleteSession}
              onOpenSession={(sessionId) => {
                onOpenSession?.(sessionId);
                setIsSidebarOpen(false);
              }}
              onNewChat={onNewChat}
              onOpenUpload={onOpenUpload}
              onOpenKnowledgeBaseUpload={onOpenKnowledgeBaseUpload}
              canManageKnowledgeBase={canManageKnowledgeBase}
            />
          </div>
        )}

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950/55 backdrop-blur-xl">
          <div className="relative flex h-14 items-center justify-center border-b border-white/10 px-3 lg:hidden">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="absolute left-3 inline-flex h-10 w-10 items-center justify-center text-slate-200 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              aria-label="Open sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold tracking-[0.16em] text-cyan-100 uppercase">IntelliSeek</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="absolute right-3 inline-flex h-10 w-10 items-center justify-center text-slate-200 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
              aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
              title={isDark ? "Switch to light theme" : "Switch to dark theme"}
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
