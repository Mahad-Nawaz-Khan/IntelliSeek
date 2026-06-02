import { MessageSquareText, Trash2 } from "lucide-react";

import type { ChatSession } from "../../lib/ui-state";

type RecentChatsProps = {
  sessions: ChatSession[];
  deletingSessionId?: string | null;
  onOpenSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
};

export function RecentChats({ sessions, deletingSessionId, onOpenSession, onDeleteSession }: RecentChatsProps) {
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 px-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <MessageSquareText className="h-3.5 w-3.5 text-cyan-200" />
        Recent Chats
      </h3>
      {sessions.length ? (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id} className="group flex items-start gap-1 rounded-xl transition hover:bg-violet-300/8">
              <button
                type="button"
                onClick={() => onOpenSession?.(session.id)}
                className={`min-w-0 flex-1 rounded-xl px-2.5 py-2 text-left transition ${
                  session.status === "active" ? "bg-cyan-300/10" : ""
                }`}
                aria-current={session.status === "active" ? "page" : undefined}
              >
                <span className="block truncate text-xs font-medium text-slate-300">{session.title}</span>
                {session.lastMessageAt && <span className="mt-1 block text-xs text-slate-500">{session.lastMessageAt}</span>}
              </button>
              {onDeleteSession ? (
                <button
                  type="button"
                  onClick={() => onDeleteSession(session.id)}
                  disabled={deletingSessionId === session.id}
                  className="mt-1.5 rounded-xl border border-red-300/15 bg-red-400/10 p-1.5 text-red-200 opacity-0 transition hover:border-red-200/40 hover:bg-red-400/20 hover:text-red-100 disabled:cursor-not-allowed disabled:opacity-60 group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Delete ${session.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl px-2.5 py-2 text-xs leading-5 text-slate-500">Saved conversations appear here after you start chatting.</p>
      )}
    </section>
  );
}
