"use client";

import { Menu } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { ChatSession, KnowledgeSourceGroup } from "../../lib/ui-state";
import { AppSidebar } from "../sidebar/AppSidebar";

type AcademicWorkspaceProps = {
  children: ReactNode;
  groups: KnowledgeSourceGroup[];
  recentChats: ChatSession[];
  sourceStatus: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  onDeleteSource?: (sourceId: string) => void;
  onNewChat?: () => void;
  onOpenUpload?: () => void;
};

export function AcademicWorkspace({
  children,
  groups,
  recentChats,
  sourceStatus,
  deletingSourceId,
  onDeleteSource,
  onNewChat,
  onOpenUpload,
}: AcademicWorkspaceProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  return (
    <main className="academic-page-shell h-dvh overflow-hidden text-slate-100">
      <div className="flex h-full items-stretch gap-px bg-white/10">
        <div className="hidden min-h-0 lg:flex lg:shrink-0">
          <AppSidebar
            groups={groups}
            recentChats={recentChats}
            sourceStatus={sourceStatus}
            deletingSourceId={deletingSourceId}
            onDeleteSource={onDeleteSource}
            onNewChat={onNewChat}
            onOpenUpload={onOpenUpload}
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
              onClose={() => setIsSidebarOpen(false)}
              onDeleteSource={onDeleteSource}
              onNewChat={onNewChat}
              onOpenUpload={onOpenUpload}
            />
          </div>
        )}

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-950/55 backdrop-blur-xl">
          <div className="border-b border-white/10 p-3 lg:hidden">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200"
            >
              <Menu className="h-4 w-4" />
              Workspace
            </button>
          </div>
          {children}
        </section>
      </div>
    </main>
  );
}
