import { ArrowRight, BookOpen, UploadCloud } from "lucide-react";
import Link from "next/link";

import { SUGGESTIONS } from "../SuggestedQueries";
import { BrandMark } from "../ui/BrandMark";

type ChatWelcomeProps = {
  disabled?: boolean;
  hasPersonalSources?: boolean;
  isDemo?: boolean;
  onSelect: (question: string) => void;
  onOpenUpload?: () => void;
};

export function ChatWelcome({
  disabled = false,
  hasPersonalSources = false,
  isDemo = false,
  onSelect,
  onOpenUpload,
}: Readonly<ChatWelcomeProps>) {
  return (
    <section className="mx-auto my-0 flex w-full min-w-0 flex-col items-center px-0 py-0 text-center lg:max-w-4xl lg:px-4">
      <BrandMark size="lg" className="mb-5" />
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">Study assistant</p>
      <h1 className="w-full max-w-full text-3xl font-semibold tracking-tight text-white md:text-4xl lg:max-w-3xl lg:text-5xl">
        What would you like to learn today?
      </h1>
      <p className="mt-4 w-full max-w-full text-sm leading-7 text-slate-400 md:text-base lg:max-w-2xl">
        {isDemo
          ? "Try a question using sample course material. Answers include sources so you can check the details."
          : hasPersonalSources
            ? "Ask a question about your notes, or try one of these prompts. Answers include sources so you can check the details."
            : "Try a question about the shared course material, or upload your own notes to get answers grounded in your files."}
      </p>

      {!isDemo && !hasPersonalSources && (
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {onOpenUpload ? (
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            >
              <UploadCloud className="h-4 w-4" />
              Upload your notes
            </button>
          ) : (
            <Link
              href="/sign-in?next=/chat"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
            >
              <UploadCloud className="h-4 w-4" />
              Sign in to upload notes
            </Link>
          )}
        </div>
      )}

      <div className="relative z-0 mt-8 grid w-full min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="glow-border group relative z-0 flex w-full min-w-0 items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/5 p-4 text-left text-sm text-slate-200 shadow-xl shadow-slate-950/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 lg:gap-4"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <BookOpen className="h-4 w-4 shrink-0 text-cyan-200" />
              <span className="truncate">{suggestion}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-cyan-200" />
          </button>
        ))}
      </div>
    </section>
  );
}
