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
    <article className={`flex gap-3 ${isUser ? "ml-8 justify-end sm:ml-16" : "mr-8 justify-start sm:mr-16"}`}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <div
        className={`max-w-[min(40rem,85%)] rounded-3xl border px-5 py-4 shadow-xl backdrop-blur-md transition sm:max-w-[min(44rem,78%)] ${
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
          <div className="max-w-none space-y-4 text-sm leading-7 text-slate-100 [&_a]:text-cyan-200 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-300/40 [&_blockquote]:pl-4 [&_blockquote]:text-slate-300 [&_code]:rounded-md [&_code]:bg-slate-950/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-cyan-100 [&_h1]:mb-3 [&_h1]:mt-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:tracking-[-0.03em] [&_h1]:text-white [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h2]:text-white [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-white [&_li]:my-1.5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_p]:my-3 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-slate-950/80 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-white [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/10 [&_th]:px-3 [&_th]:py-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
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
