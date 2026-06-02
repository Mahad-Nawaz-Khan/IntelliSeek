import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

import type { ChatMessage as ChatMessageType } from "../../lib/chat-api";
import { groupSourceCitations } from "../../lib/source-citations";
import { SourceChip } from "../sources/SourceChip";

type ChatMessageProps = {
  message: ChatMessageType;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const content = message.displayedContent ?? message.content;
  const sourceGroups = message.sources?.length ? groupSourceCitations(message.sources) : [];

  return (
    <article className={`flex gap-2 md:gap-3 ${isUser ? "ml-4 justify-end md:ml-16" : "mr-2 justify-start md:mr-16"}`}>
      {!isUser && (
        <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <Bot className="h-5 w-5" />
        </div>
      )}

      <div
        className={`transition ${
          isUser
            ? "max-w-[min(40rem,85%)] rounded-3xl border border-cyan-300/20 bg-cyan-500/15 px-5 py-4 text-cyan-50 shadow-xl shadow-cyan-950/20 backdrop-blur-md md:max-w-[min(44rem,78%)]"
            : message.status === "error"
              ? "w-full max-w-[1000px] rounded-3xl border border-red-300/20 bg-red-500/10 px-5 py-4 text-red-100 shadow-xl shadow-red-950/20 backdrop-blur-md"
              : "w-full max-w-[1000px] px-2 py-2 text-slate-100"
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
          <div className="max-w-none space-y-3 text-[0.8125rem] leading-6 text-slate-100 md:space-y-4 md:text-sm md:leading-7 lg:text-base lg:leading-8 [&_a]:text-cyan-200 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-300/40 [&_blockquote]:pl-4 [&_blockquote]:text-slate-300 [&_code]:rounded-md [&_code]:bg-slate-950/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-cyan-100 [&_h1]:mb-3 [&_h1]:mt-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:tracking-[-0.03em] [&_h1]:text-white md:[&_h1]:text-xl lg:[&_h1]:text-2xl [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h2]:text-white md:[&_h2]:text-lg lg:[&_h2]:text-xl [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white md:[&_h3]:text-base lg:[&_h3]:text-lg [&_li]:my-1.5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_p]:my-3 md:[&_p]:text-justify md:[&_p]:hyphens-auto [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-2xl [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-slate-950/80 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-white [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/10 [&_th]:px-3 [&_th]:py-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}

        {!isUser && message.status === "complete" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            {sourceGroups.length ? (
              sourceGroups.map((group) => (
                <SourceChip
                  key={group.documentId}
                  group={group}
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
