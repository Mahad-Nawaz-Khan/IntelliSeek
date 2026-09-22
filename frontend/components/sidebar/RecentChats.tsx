"use client";

import { MessageSquareText, Pencil, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import type { ChatSession } from "../../lib/ui-state";
import { SessionTitleLabel } from "./SessionTitleLabel";

type RecentChatsProps = {
  sessions: ChatSession[];
  deletingSessionId?: string | null;
  onOpenSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, title: string) => Promise<boolean>;
};

export function RecentChats({ sessions, deletingSessionId, onOpenSession, onDeleteSession, onRenameSession }: RecentChatsProps) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingSessionId, setSavingSessionId] = useState<string | null>(null);

  const startEditing = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setDraftTitle(session.title);
  };

  const stopEditing = () => {
    setEditingSessionId(null);
    setDraftTitle("");
  };

  const commitRename = async (sessionId: string) => {
    const nextTitle = draftTitle.trim();
    const current = sessions.find((session) => session.id === sessionId);
    stopEditing();
    if (!onRenameSession || !nextTitle || nextTitle === current?.title || savingSessionId) return;

    setSavingSessionId(sessionId);
    await onRenameSession(sessionId, nextTitle);
    setSavingSessionId(null);
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>, sessionId: string) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename(sessionId);
    }
    if (event.key === "Escape") stopEditing();
  };

  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 px-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <MessageSquareText className="h-3.5 w-3.5 text-cyan-200" />
        Recent Chats
      </h3>
      {sessions.length ? (
        <ul className="space-y-2">
          {sessions.map((session) => {
            const isEditing = editingSessionId === session.id;
            const isBusy = savingSessionId === session.id;
            return (
              <li key={session.id} className="group flex items-center gap-0.5 rounded-xl transition hover:bg-violet-300/8">
                {isEditing ? (
                  <input
                    autoFocus
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onKeyDown={(event) => handleRenameKeyDown(event, session.id)}
                    onBlur={() => void commitRename(session.id)}
                    disabled={isBusy}
                    maxLength={80}
                    aria-label="Chat name"
                    className="min-w-0 flex-1 rounded-lg border border-cyan-300/40 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/70"
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onOpenSession?.(session.id)}
                      className={`min-w-0 flex-1 rounded-xl px-2.5 py-2 text-left transition ${
                        session.status === "active" ? "bg-cyan-300/10" : ""
                      }`}
                      aria-current={session.status === "active" ? "page" : undefined}
                    >
                      <SessionTitleLabel title={session.title} />
                    </button>
                    {onRenameSession ? (
                      <button
                        type="button"
                        onClick={() => startEditing(session)}
                        className="rounded p-0.5 text-cyan-200/60 opacity-0 transition hover:text-cyan-100 hover:drop-shadow-[0_0_5px_rgba(103,232,249,0.75)] focus:opacity-100 group-hover:opacity-100"
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
                    onClick={() => onDeleteSession(session.id)}
                    disabled={deletingSessionId === session.id}
                    className="rounded p-0.5 text-red-300/60 opacity-0 transition hover:text-red-200 hover:drop-shadow-[0_0_5px_rgba(248,113,113,0.75)] focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40 group-hover:disabled:opacity-40"
                    aria-label={`Delete ${session.title}`}
                    title="Delete chat"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl px-2.5 py-2 text-xs leading-5 text-slate-500">Saved conversations appear here after you start chatting.</p>
      )}
    </section>
  );
}
