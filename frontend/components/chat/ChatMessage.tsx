import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

import type { ChatMessage as ChatMessageType } from "../../lib/chat-api";
import { SourceChip } from "../sources/SourceChip";

type ChatMessageProps = {
  message: ChatMessageType;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const content = message.displayedContent ?? message.content;

  return (
    <article className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <div
        className={`max-w-[min(44rem,88%)] rounded-3xl border px-5 py-4 shadow-xl backdrop-blur-md transition sm:max-w-[min(48rem,82%)] ${
          isUser
            ? "border-cyan-300/20 bg-cyan-500/15 text-cyan-50 shadow-cyan-950/20"
            : message.status === "error"
              ? "border-red-300/20 bg-red-500/10 text-red-100 shadow-red-950/20"
              : "border-white/10 bg-white/[0.07] text-slate-100 shadow-slate-950/20"
        }`}
      >
        {message.status === "loading" ? (
          <div className="space-y-3" aria-label="IntelliSeek is analyzing your documents">
            <p className="text-sm text-cyan-100">IntelliSeek is analyzing your documents...</p>
            <div className="flex items-center gap-2 py-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300 [animation-delay:240ms]" />
            </div>
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none prose-p:my-2 prose-li:my-0 prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950/70 prose-strong:text-slate-100">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}

        {!isUser && message.status === "complete" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {message.sources?.length ? (
              message.sources.map((source) => (
                <SourceChip
                  key={`${source.document_id}-${source.chunk_id}-${source.chunk_index}`}
                  source={source}
                />
              ))
            ) : (
              <span className="text-xs text-slate-500">No source metadata returned. Try asking about uploaded or built-in course notes.</span>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-slate-200">
          <User className="h-5 w-5" />
        </div>
      )}
    </article>
  );
}
