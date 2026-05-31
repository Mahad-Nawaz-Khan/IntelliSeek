"use client";

import { BookOpen, GraduationCap, Library, LogOut, MessageSquarePlus, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "../../context/AuthContext";
import type { ChatSession, KnowledgeSourceGroup } from "../../lib/ui-state";
import { PrimaryButton } from "../ui/PrimaryButton";
import { RecentChats } from "./RecentChats";
import { SourceGroups } from "./SourceGroups";

type AppSidebarProps = {
  groups: KnowledgeSourceGroup[];
  recentChats: ChatSession[];
  sourceStatus: "loading" | "ready" | "empty" | "unavailable";
  deletingSourceId?: string | null;
  onClose?: () => void;
  onDeleteSource?: (sourceId: string) => void;
  onNewChat?: () => void;
  onOpenUpload?: () => void;
};

const navigation = [
  { href: "/chat", label: "Assistant", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ groups, recentChats, sourceStatus, deletingSourceId, onClose, onDeleteSource, onNewChat, onOpenUpload }: AppSidebarProps) {
  const pathname = usePathname();
  const { signOut, user } = useAuth();

  return (
    <aside className="scrollbar-hidden flex h-full w-full flex-col gap-3 overflow-y-auto bg-slate-950/75 px-3 py-4 backdrop-blur-xl lg:w-[232px] lg:shrink-0">
      <div className="flex items-start justify-between gap-2 px-1 py-1">
        <Link href="/chat" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cyan-300 text-slate-950">
            <GraduationCap className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-cyan-100">IntelliSeek</span>
            <span className="block truncate text-sm font-semibold text-white">Academic AI</span>
          </span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5 lg:hidden" aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <PrimaryButton type="button" onClick={onNewChat} variant="secondary" className="h-9 w-full justify-start rounded-xl px-2.5 text-xs">
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
              className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition ${
                active
                  ? "bg-cyan-300/12 text-cyan-50"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
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
          onDeleteSource={onDeleteSource}
          onOpenUpload={onOpenUpload}
        />
      </div>

      <div className="pt-1">
        <RecentChats sessions={recentChats} />
      </div>

      <div className="mt-auto border-t border-white/10 px-1 pt-3">
        <p className="truncate text-[0.65rem] text-slate-500">Signed in as</p>
        <p className="truncate text-xs font-medium text-white">{user?.email ?? "IntelliSeek user"}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-red-400/10 hover:text-red-100"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
