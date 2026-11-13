"use client";

import { BookOpen, FileUp, Library, LogOut, Menu, MessageSquarePlus, Settings, UserCircle, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "../../context/AuthContext";
import type { ChatSession, KnowledgeSource, KnowledgeSourceGroup } from "../../lib/ui-state";
import { PrimaryButton } from "../ui/PrimaryButton";
import { BrandMark } from "../ui/BrandMark";
import { RecentChats } from "./RecentChats";
import { SourceGroups } from "./SourceGroups";

type AppSidebarProps = {
  groups: KnowledgeSourceGroup[];
  recentChats: ChatSession[];
  sourceStatus: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  deletingSessionId?: string | null;
  focusedSourceId?: string | null;
  includeKnowledgeBase?: boolean;
  onToggleKnowledgeBase?: () => void;
  onSelectSource?: (source: KnowledgeSource) => void;
  onClose?: () => void;
  onDeleteSource?: (sourceId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, title: string) => Promise<boolean>;
  onOpenSession?: (sessionId: string) => void;
  onNewChat?: () => void;
  onOpenUpload?: () => void;
  onOpenKnowledgeBaseUpload?: () => void;
  canManageKnowledgeBase?: boolean;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
};

const navigation = [
  { href: "/chat", label: "Assistant", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({
  groups,
  recentChats,
  sourceStatus,
  deletingSourceId,
  deletingSessionId,
  focusedSourceId,
  includeKnowledgeBase = true,
  onToggleKnowledgeBase,
  onSelectSource,
  onClose,
  onDeleteSource,
  onDeleteSession,
  onRenameSession,
  onOpenSession,
  onNewChat,
  onOpenUpload,
  onOpenKnowledgeBaseUpload,
  canManageKnowledgeBase,
  isCollapsed,
  onToggleCollapsed,
}: Readonly<AppSidebarProps>) {
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  if (isCollapsed) {
    return (
      <aside className="flex h-full min-h-0 w-16 shrink-0 flex-col items-center gap-2 overflow-hidden bg-slate-950/75 px-1.5 py-4 backdrop-blur-xl">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="my-1 h-px w-6 shrink-0 bg-white/10" />

        <div className="scrollbar-hidden flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto py-0.5">
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-100 transition hover:bg-violet-400/20 hover:text-white"
              aria-label="New chat"
              title="New chat"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          )}

          {onOpenUpload && (
            <button
              type="button"
              onClick={onOpenUpload}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 transition hover:bg-cyan-300/20 hover:text-white"
              aria-label="Upload document"
              title="Upload document"
            >
              <FileUp className="h-4 w-4" />
            </button>
          )}

          <nav className="mt-1 flex shrink-0 flex-col items-center gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl transition ${
                    active
                      ? "bg-cyan-300/15 text-cyan-50 ring-1 ring-cyan-300/25"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto flex shrink-0 flex-col items-center gap-2 pt-1">
          {user?.email ? (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-300/25"
              title={`Signed in as ${user.email}`}
              aria-label={`Signed in as ${user.email}`}
            >
              {user.email.charAt(0).toUpperCase()}
            </span>
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-slate-400"
              title="User profile"
              aria-label="User profile"
            >
              <UserCircle className="h-5 w-5" />
            </span>
          )}
          <button
            type="button"
            onClick={signOut}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-400/15 hover:text-red-200"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-slate-950/75 backdrop-blur-xl lg:w-64 lg:shrink-0">
      <div className="shrink-0 px-3 pt-4 pb-2">
        <div className="flex items-start justify-between gap-2 px-1 py-1">
          <Link href="/chat" className="flex min-w-0 items-center gap-2.5">
            <BrandMark />
            <span className="min-w-0">
              <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">IntelliSeek</span>
              <span className="block truncate text-sm font-semibold text-white">Academic AI</span>
            </span>
          </Link>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white lg:inline-flex"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-3 py-1">
        <div className="space-y-3">
          <PrimaryButton
            type="button"
            onClick={onNewChat}
            variant="secondary"
            className="h-9.5 w-full justify-start rounded-xl px-3 text-xs shadow-sm"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New Chat
          </PrimaryButton>

          <nav className="grid gap-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onClose?.()}
                  className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition hover:cursor-pointer ${
                    active
                      ? "bg-cyan-300/12 text-cyan-50 ring-1 ring-cyan-300/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.75 -translate-y-1/2 rounded-r-full bg-cyan-300" />
                  )}
                  <Icon className={`h-3.5 w-3.5 ${active ? "text-cyan-300" : ""}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-1">
            <SourceGroups
              groups={groups}
              status={sourceStatus}
              deletingSourceId={deletingSourceId}
              focusedSourceId={focusedSourceId}
              includeKnowledgeBase={includeKnowledgeBase}
              onToggleKnowledgeBase={onToggleKnowledgeBase}
              onSelectSource={onSelectSource}
              onDeleteSource={onDeleteSource}
              onOpenUpload={onOpenUpload}
              onOpenKnowledgeBaseUpload={onOpenKnowledgeBaseUpload}
              canManageKnowledgeBase={canManageKnowledgeBase}
            />
          </div>

          <div className="pt-1">
            <RecentChats
              sessions={recentChats}
              deletingSessionId={deletingSessionId}
              onDeleteSession={onDeleteSession}
              onRenameSession={onRenameSession}
              onOpenSession={onOpenSession}
            />
          </div>
        </div>
      </div>

      <div className="mx-3 shrink-0 border-t border-white/10 px-1 pt-3 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-300/20">
            {user?.email ? user.email.charAt(0).toUpperCase() : "U"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.65rem] text-slate-500">Signed in as</p>
            <p className="truncate text-xs font-medium text-white">{user?.email ?? "IntelliSeek user"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2 text-xs font-medium text-slate-300 transition hover:border-red-400/20 hover:bg-red-400/10 hover:text-red-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
