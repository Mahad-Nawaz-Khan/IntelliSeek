import { MessageSquareText } from "lucide-react";

import type { ChatSession } from "../../lib/ui-state";

type RecentChatsProps = {
  sessions: ChatSession[];
};

export function RecentChats({ sessions }: RecentChatsProps) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        <MessageSquareText className="h-3.5 w-3.5 text-cyan-200" />
        Recent Chats
      </h3>
      {sessions.length ? (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <button type="button" className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:border-violet-300/20 hover:bg-violet-300/8">
                <span className="block truncate text-sm font-medium text-slate-200">{session.title}</span>
                {session.lastMessageAt && <span className="mt-1 block text-xs text-slate-500">{session.lastMessageAt}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm leading-6 text-slate-500">Recent questions appear here after you start chatting.</p>
      )}
    </section>
  );
}
