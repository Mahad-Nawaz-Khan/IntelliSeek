"use client";

import { Check, Copy, RotateCcw, Terminal } from "lucide-react";
import { isValidElement, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

import type { ChatMessage as ChatMessageType } from "../../lib/chat-api";
import { usePreferences } from "../../lib/preferences";
import { groupSourceCitations } from "../../lib/source-citations";
import { SourceChip } from "../sources/SourceChip";
import { BrandMark } from "../ui/BrandMark";

type ChatMessageProps = {
  message: ChatMessageType;
  onRetry?: () => void;
};

function getMessageContainerClass(isUser: boolean, status: ChatMessageType["status"], compact: boolean): string {
  if (isUser) {
    return `max-w-[min(40rem,85%)] rounded-3xl border border-cyan-300/20 bg-cyan-500/15 ${
      compact ? "px-4 py-2.5" : "px-5 py-3.5"
    } text-cyan-50 shadow-xl shadow-cyan-950/20 backdrop-blur-md md:max-w-[min(44rem,78%)]`;
  }
  if (status === "error") {
    return "w-full max-w-[1000px] rounded-3xl border border-red-300/20 bg-red-500/10 px-5 py-4 text-red-100 shadow-xl shadow-red-950/20 backdrop-blur-md";
  }
  return `w-full max-w-[1000px] px-2 ${compact ? "py-1" : "py-2"} text-slate-100`;
}

function extractTextFromChildren(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromChildren).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractTextFromChildren(node.props.children);
  }
  return "";
}

function CodeBlockPre({ children }: Readonly<{ children?: ReactNode }>) {
  const [copied, setCopied] = useState(false);

  let language = "code";
  if (isValidElement<{ className?: string }>(children) && typeof children.props.className === "string") {
    const match = /language-([\w+-]+)/.exec(children.props.className);
    if (match?.[1]) language = match[1];
  }

  const rawCode = extractTextFromChildren(children).replace(/\n$/, "");

  const handleCopy = () => {
    if (!rawCode || typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(rawCode).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  return (
    <div className="my-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85 shadow-lg">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-mono text-[0.7rem] uppercase tracking-wider text-cyan-200/80">
          <Terminal className="h-3.5 w-3.5" />
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[0.7rem] font-medium text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/10 hover:text-white"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-300">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="!my-0 overflow-x-auto !border-0 !bg-transparent p-4 text-xs leading-6 sm:text-sm">
        {children}
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  pre: ({ children }) => <CodeBlockPre>{children}</CodeBlockPre>,
};

function renderMessageBody(
  isPreparing: boolean,
  isStreaming: boolean,
  isUser: boolean,
  content: string,
  compact: boolean,
) {
  if (isPreparing) {
    return (
      <output aria-live="polite" className="block space-y-2.5 py-1">
        <span className="sr-only">IntelliSeek is preparing an answer</span>
        <span className="block h-3.5 w-48 animate-pulse rounded-full bg-cyan-300/20" />
        <span className="block h-3.5 w-72 max-w-full animate-pulse rounded-full bg-white/10" />
      </output>
    );
  }
  if (isUser) {
    return <p className="whitespace-pre-wrap text-sm leading-6">{content}</p>;
  }
  return (
    <div
      className={`max-w-none ${
        compact
          ? "space-y-2 text-[0.8125rem] leading-6"
          : "space-y-3 text-[0.8125rem] leading-6 md:space-y-4 md:text-sm md:leading-7 lg:text-base lg:leading-8"
      } text-slate-100 [&_a]:text-cyan-200 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-2 [&_blockquote]:border-cyan-300/40 [&_blockquote]:pl-4 [&_blockquote]:text-slate-300 [&_code]:rounded-md [&_code]:bg-slate-950/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-cyan-100 [&_h1]:mb-3 [&_h1]:mt-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:tracking-[-0.03em] [&_h1]:text-white md:[&_h1]:text-xl lg:[&_h1]:text-2xl [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:tracking-[-0.03em] [&_h2]:text-white md:[&_h2]:text-lg lg:[&_h2]:text-xl [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-white md:[&_h3]:text-base lg:[&_h3]:text-lg [&_li]:my-1.5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_p]:my-3 md:[&_p]:text-justify md:[&_p]:hyphens-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-white [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-white/10 [&_th]:bg-white/10 [&_th]:px-3 [&_th]:py-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6`}
    >
      <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
      {isStreaming && (
        <span
          aria-hidden="true"
          className="mt-1 inline-flex items-center gap-1.5 text-[0.7rem] font-medium tracking-wide text-cyan-200/75"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
          <span>Streaming...</span>
        </span>
      )}
    </div>
  );
}

export function ChatMessage({ message, onRetry }: Readonly<ChatMessageProps>) {
  const { preferences } = usePreferences();
  const [copiedMessage, setCopiedMessage] = useState(false);

  const isUser = message.role === "user";
  const content = message.displayedContent ?? message.content;
  const sourceGroups = message.sources?.length ? groupSourceCitations(message.sources) : [];
  const isStreaming = !isUser && message.status === "loading";
  const isPreparing = isStreaming && !content;

  const handleCopyMessage = () => {
    if (!content || typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopiedMessage(true);
      window.setTimeout(() => setCopiedMessage(false), 1800);
    }).catch(() => {});
  };

  return (
    <article className={`group/msg flex flex-col ${isUser ? "ml-4 items-end md:ml-16" : "mr-2 items-start md:mr-16"}`}>
      {!isUser && (
        <div className="mb-2 flex items-center gap-2">
          <BrandMark spinning={isStreaming} />
          <span className="text-xs font-medium tracking-wide text-cyan-200/70">IntelliSeek</span>
        </div>
      )}

      <div className={`transition ${getMessageContainerClass(isUser, message.status, preferences.compactMessages)}`}>
        {renderMessageBody(isPreparing, isStreaming, isUser, content, preferences.compactMessages)}

        {!isUser && message.status === "complete" && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
            <div className="flex flex-wrap gap-2">
              {sourceGroups.length ? (
                sourceGroups.map((group) => (
                  <SourceChip
                    key={group.documentId}
                    group={group}
                  />
                ))
              ) : (
                <span className="text-xs text-slate-500">
                  No source metadata returned. Try asking about uploaded or built-in course notes.
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCopyMessage}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/10 hover:text-white"
                aria-label="Copy response"
                title="Copy response"
              >
                {copiedMessage ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:bg-white/10 hover:text-white"
                  aria-label="Regenerate response"
                  title="Regenerate response"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          </div>
        )}

        {!isUser && message.status === "error" && onRetry && (
          <div className="mt-3 flex items-center gap-2 border-t border-red-300/15 pt-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300/30 bg-red-400/15 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:bg-red-400/25"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="mt-1 flex items-center gap-1 opacity-0 transition group-hover/msg:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[0.68rem] text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            aria-label="Copy prompt"
          >
            {copiedMessage ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copiedMessage ? "Copied" : "Copy"}</span>
          </button>
        </div>
      )}
    </article>
  );
}
