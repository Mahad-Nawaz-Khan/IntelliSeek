"use client";

import { Menu, MessageCircleDashed, Moon, Sun } from "lucide-react";
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
  includeKnowledgeBase?: boolean;
  isTemporaryChat?: boolean;
  onToggleTemporaryChat?: () => void;
  onToggleKnowledgeBase?: () => void;
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

function readStoredSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistSidebarCollapsed(next: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Ignore storage errors
  }
}

type MobileHeaderBarProps = {
  isDark: boolean;
  isTemporaryChat: boolean;
  onOpenSidebar: () => void;
  onToggleTemporaryChat?: () => void;
  onToggleTheme: () => void;
};

function MobileHeaderBar({
  isDark,
  isTemporaryChat,
  onOpenSidebar,
  onToggleTemporaryChat,
  onToggleTheme,
}: Readonly<MobileHeaderBarProps>) {
  const tempChatLabel = isTemporaryChat ? "Exit temporary chat" : "Start temporary chat";
  const themeLabel = isDark ? "Switch to light theme" : "Switch to dark theme";
  const tempChatClass = isTemporaryChat
    ? "border border-dashed border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
    : "text-slate-200 hover:bg-white/5 hover:text-white";

  return (
    <div className="relative flex h-14 items-center justify-center border-b border-white/10 px-3 lg:hidden">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="absolute left-3 inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="text-sm font-semibold tracking-[0.16em] text-cyan-100 uppercase">IntelliSeek</span>
      <div className="absolute right-3 flex items-center gap-1">
        {onToggleTemporaryChat && (
          <button
            type="button"
            onClick={onToggleTemporaryChat}
            aria-pressed={isTemporaryChat}
            aria-label={tempChatLabel}
            title={tempChatLabel}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 md:hidden ${tempChatClass}`}
          >
            <MessageCircleDashed className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-200 transition hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          aria-label={themeLabel}
          title={themeLabel}
          suppressHydrationWarning
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

type MobileSidebarDrawerProps = Omit<
  AcademicWorkspaceProps,
  "children" | "isTemporaryChat" | "onToggleTemporaryChat"
> & {
  onClose: () => void;
};

function MobileSidebarDrawer({
  groups,
  recentChats,
  sourceStatus,
  deletingSourceId,
  deletingSessionId,
  focusedSourceId,
  includeKnowledgeBase,
  onToggleKnowledgeBase,
  onSelectSource,
  onDeleteSource,
  onDeleteSession,
  onRenameSession,
  onOpenSession,
  onNewChat,
  onOpenUpload,
  onOpenKnowledgeBaseUpload,
  canManageKnowledgeBase,
  onClose,
}: Readonly<MobileSidebarDrawerProps>) {
  const handleSelectSource = onSelectSource
    ? (source: KnowledgeSource) => {
        onSelectSource(source);
        onClose();
      }
    : undefined;

  const handleOpenKnowledgeBaseUpload = onOpenKnowledgeBaseUpload
    ? () => {
        onOpenKnowledgeBaseUpload();
        onClose();
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/75 p-3 backdrop-blur-sm lg:hidden">
      <AppSidebar
        groups={groups}
        recentChats={recentChats}
        sourceStatus={sourceStatus}
        deletingSourceId={deletingSourceId}
        deletingSessionId={deletingSessionId}
        focusedSourceId={focusedSourceId}
        includeKnowledgeBase={includeKnowledgeBase}
        onToggleKnowledgeBase={onToggleKnowledgeBase}
        onClose={onClose}
        onSelectSource={handleSelectSource}
        onDeleteSource={onDeleteSource}
        onDeleteSession={onDeleteSession}
        onRenameSession={onRenameSession}
        onOpenSession={(sessionId) => {
          onOpenSession?.(sessionId);
          onClose();
        }}
        onNewChat={() => {
          onNewChat?.();
          onClose();
        }}
        onOpenUpload={() => {
          onOpenUpload?.();
          onClose();
        }}
        onOpenKnowledgeBaseUpload={handleOpenKnowledgeBaseUpload}
        canManageKnowledgeBase={canManageKnowledgeBase}
      />
    </div>
  );
}

export function AcademicWorkspace({
  children,
  groups,
  recentChats,
  sourceStatus,
  deletingSourceId,
  deletingSessionId,
  focusedSourceId,
  includeKnowledgeBase = true,
  isTemporaryChat = false,
  onToggleTemporaryChat,
  onToggleKnowledgeBase,
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
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(readStoredSidebarCollapsed);
  const isDark = theme === "dark";

  const handleToggleDesktopSidebar = () => {
    setIsDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      persistSidebarCollapsed(next);
      return next;
    });
  };

  return (
    <main className="academic-page-shell chat-fade-in h-dvh overflow-hidden text-slate-100">
      <div className="flex h-full items-stretch gap-px bg-white/10">
        <div className="hidden min-h-0 lg:flex lg:shrink-0">
          <AppSidebar
            groups={groups}
            recentChats={recentChats}
            sourceStatus={sourceStatus}
            deletingSourceId={deletingSourceId}
            deletingSessionId={deletingSessionId}
            focusedSourceId={focusedSourceId}
            includeKnowledgeBase={includeKnowledgeBase}
            onToggleKnowledgeBase={onToggleKnowledgeBase}
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
          <MobileSidebarDrawer
            groups={groups}
            recentChats={recentChats}
            sourceStatus={sourceStatus}
            deletingSourceId={deletingSourceId}
            deletingSessionId={deletingSessionId}
            focusedSourceId={focusedSourceId}
            includeKnowledgeBase={includeKnowledgeBase}
            onToggleKnowledgeBase={onToggleKnowledgeBase}
            onSelectSource={onSelectSource}
            onDeleteSource={onDeleteSource}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
            onOpenSession={onOpenSession}
            onNewChat={onNewChat}
            onOpenUpload={onOpenUpload}
            onOpenKnowledgeBaseUpload={onOpenKnowledgeBaseUpload}
            canManageKnowledgeBase={canManageKnowledgeBase}
            onClose={() => setIsSidebarOpen(false)}
          />
        )}

        <section
          style={{ backgroundColor: "var(--chat-workspace-bg, #0a0e22)" }}
          className="chat-workspace-surface flex min-h-0 flex-1 flex-col overflow-clip bg-[#0a0e22]"
        >
          <MobileHeaderBar
            isDark={isDark}
            isTemporaryChat={isTemporaryChat}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            onToggleTemporaryChat={onToggleTemporaryChat}
            onToggleTheme={toggleTheme}
          />
          {children}
        </section>
      </div>
    </main>
  );
}
