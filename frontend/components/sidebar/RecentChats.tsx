"use client";

import { Check, MessageSquareText, Pencil, Search, Trash2, X } from "lucide-react";
import { useMemo, useState, type KeyboardEvent } from "react";

import type { ChatSession } from "../../lib/ui-state";
import { SessionTitleLabel } from "./SessionTitleLabel";

type RecentChatsProps = {
  sessions: ChatSession[];
  deletingSessionId?: string | null;
  onOpenSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, title: string) => Promise<boolean>;
};

export function RecentChats({
  sessions,
  deletingSessionId,
  onOpenSession,
  onDeleteSession,
  onRenameSession,
}: Readonly<RecentChatsProps>) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [filterQuery, setFilterQuery] = useState("");

  const filteredSessions = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [filterQuery, sessions]);

  const startEditing = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setDraftTitle(session.title);
  };

  const stopEditing = () => {
    setEditingSessionId(null);
    setDraftTitle("");
  };

  const commitRename = (sessionId: string) => {
    const nextTitle = draftTitle.trim();
    const current = sessions.find((session) => session.id === sessionId);
    stopEditing();
    if (!onRenameSession || !nextTitle || nextTitle === current?.title) return;

    void onRenameSession(sessionId, nextTitle);
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>, sessionId: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitRename(sessionId);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      stopEditing();
    }
  };

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between px-2.5">
        <h3 className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <MessageSquareText className="h-3.5 w-3.5 text-cyan-200" />
          Recent Chats
        </h3>
        {sessions.length > 0 && (
          <span className="text-[0.65rem] font-medium text-slate-500">{sessions.length}</span>
        )}
      </div>

      {sessions.length > 4 && (
        <div className="mb-2 px-1">
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3 w-3 text-slate-500" />
            <input
              type="text"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="Filter chats..."
              aria-label="Filter recent chats"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-7 pr-6 text-xs text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-white/[0.06]"
            />
            {filterQuery && (
              <button
                type="button"
                onClick={() => setFilterQuery("")}
                className="absolute right-1.5 rounded p-0.5 text-slate-500 hover:text-slate-200"
                aria-label="Clear chat filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {filteredSessions.length ? (
        <ul className="space-y-1">
          {filteredSessions.map((session) => {
            const isEditing = editingSessionId === session.id;
            const isActive = session.status === "active";

            return (
              <li
                key={session.id}
                className={`group relative flex items-center gap-1 rounded-xl pr-1 transition-all duration-150 ${
                  isActive
                    ? "bg-cyan-300/12 ring-1 ring-cyan-300/20"
                    : "hover:bg-white/[0.05]"
                }`}
              >
                {isActive && !isEditing && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.75 -translate-y-1/2 rounded-r-full bg-cyan-300" />
                )}
                {isEditing ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1 py-1 pl-1.5">
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      onKeyDown={(event) => handleRenameKeyDown(event, session.id)}
                      onBlur={() => commitRename(session.id)}
                      maxLength={80}
                      aria-label="Chat name"
                      className="min-w-0 flex-1 rounded-lg border border-cyan-300/40 bg-slate-900/80 px-2 py-1 text-xs text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/80"
                    />
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => commitRename(session.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-emerald-300 transition hover:bg-emerald-500/15"
                      aria-label="Save chat name"
                      title="Save"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={stopEditing}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/10 hover:text-white"
                      aria-label="Cancel rename"
                      title="Cancel"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenSession?.(session.id)}
                      className="min-w-0 flex-1 rounded-xl px-2.5 py-2 text-left transition"
                      aria-current={isActive ? "page" : undefined}
                    >
                      <SessionTitleLabel
                        title={session.title}
                        className={isActive ? "text-xs font-semibold text-cyan-50" : "text-xs font-medium text-slate-300"}
                      />
                    </button>
                    {onRenameSession ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startEditing(session);
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-all duration-150 hover:bg-cyan-500/15 hover:text-cyan-200 active:scale-90 focus:opacity-100 group-hover:opacity-100"
                        aria-label={`Rename ${session.title}`}
                        title="Rename chat"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    ) : null}
                  </>
                )}
                {onDeleteSession && !isEditing ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    disabled={deletingSessionId === session.id}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-all duration-150 hover:bg-red-500/15 hover:text-red-200 active:scale-90 focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label={`Delete ${session.title}`}
                    title="Delete chat"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : sessions.length > 0 ? (
        <p className="rounded-xl px-2.5 py-2 text-xs text-slate-500">No chats match &ldquo;{filterQuery}&rdquo;.</p>
      ) : (
        <p className="rounded-xl px-2.5 py-2 text-xs leading-5 text-slate-500">
          Saved conversations appear here after you start chatting.
        </p>
      )}
    </section>
  );
}
