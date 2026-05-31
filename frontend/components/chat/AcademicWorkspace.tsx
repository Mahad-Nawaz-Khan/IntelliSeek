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
};

export function AcademicWorkspace({
  children,
  groups,
  recentChats,
  sourceStatus,
  deletingSourceId,
  onDeleteSource,
  onNewChat,
}: AcademicWorkspaceProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <main className="academic-page-shell min-h-dvh text-slate-100">
      <div className="flex min-h-dvh items-stretch gap-4 p-3 sm:p-4 lg:p-6">
        <div className="hidden lg:flex lg:shrink-0">
          <AppSidebar
            groups={groups}
            recentChats={recentChats}
            sourceStatus={sourceStatus}
            deletingSourceId={deletingSourceId}
            onDeleteSource={onDeleteSource}
            onNewChat={onNewChat}
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
            />
          </div>
        )}

        <section className="flex min-h-[calc(100dvh-1.5rem)] flex-1 flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/50 shadow-2xl shadow-slate-950/40 backdrop-blur-xl sm:min-h-[calc(100dvh-2rem)] lg:min-h-[calc(100dvh-3rem)]">
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
