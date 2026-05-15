"use client";

import { BookOpen, GraduationCap, Library, MessageSquarePlus, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { ChatSession, KnowledgeSourceGroup } from "../../lib/ui-state";
import { PrimaryButton } from "../ui/PrimaryButton";
import { RecentChats } from "./RecentChats";
import { SourceGroups } from "./SourceGroups";

type AppSidebarProps = {
  groups: KnowledgeSourceGroup[];
  recentChats: ChatSession[];
  sourceStatus: "loading" | "ready" | "empty" | "unavailable";
  onClose?: () => void;
  onNewChat?: () => void;
};

const navigation = [
  { href: "/chat", label: "Assistant", icon: BookOpen },
  { href: "/library", label: "Library", icon: Library },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ groups, recentChats, sourceStatus, onClose, onNewChat }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col gap-4 overflow-y-auto rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-slate-950/40 backdrop-blur-xl lg:w-[280px] lg:shrink-0">
      <div className="flex items-start justify-between gap-3 rounded-3xl border border-cyan-300/15 bg-cyan-300/10 p-4">
        <Link href="/chat" className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-300 text-slate-950">
            <GraduationCap className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">IntelliSeek</span>
            <span className="block truncate text-lg font-semibold text-white">Academic AI</span>
          </span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 lg:hidden" aria-label="Close sidebar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <PrimaryButton type="button" onClick={onNewChat} variant="secondary" className="w-full justify-start">
        <MessageSquarePlus className="h-4 w-4" />
        New Chat
      </PrimaryButton>

      <nav className="grid gap-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-cyan-300/25 bg-cyan-300/12 text-cyan-50"
                  : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/15 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-3">
        <SourceGroups groups={groups} status={sourceStatus} />
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
        <RecentChats sessions={recentChats} />
      </div>
    </aside>
  );
}
