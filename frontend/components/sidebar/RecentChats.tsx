import { MessageSquareText } from "lucide-react";

import type { ChatSession } from "../../lib/ui-state";

type RecentChatsProps = {
  sessions: ChatSession[];
};

export function RecentChats({ sessions }: RecentChatsProps) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 px-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <MessageSquareText className="h-3.5 w-3.5 text-cyan-200" />
        Recent Chats
      </h3>
      {sessions.length ? (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id}>
              <button type="button" className="w-full rounded-xl px-2.5 py-2 text-left transition hover:bg-violet-300/8">
                <span className="block truncate text-xs font-medium text-slate-300">{session.title}</span>
                {session.lastMessageAt && <span className="mt-1 block text-xs text-slate-500">{session.lastMessageAt}</span>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl px-2.5 py-2 text-xs leading-5 text-slate-500">Recent questions appear here after you start chatting.</p>
      )}
    </section>
  );
}
