import { ArrowRight, BookOpen, Sparkles } from "lucide-react";

import { SUGGESTIONS } from "../SuggestedQueries";

type ChatWelcomeProps = {
  disabled?: boolean;
  onSelect: (question: string) => void;
};

export function ChatWelcome({ disabled = false, onSelect }: ChatWelcomeProps) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 py-0 mt-0 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-[1.25rem] border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-2xl shadow-cyan-950/30">
        <Sparkles className="h-7 w-7" />
      </div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-cyan-200">Semantic Academic Assistant</p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        What would you like to learn today?
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400 sm:text-base">
        Upload notes or ask from the built-in knowledge base. IntelliSeek highlights source-grounded answers for academic review.
      </p>

      <div className="mt-10 grid w-full gap-3 sm:grid-cols-2 relative z-0">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="glow-border group relative z-0 flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-4 text-left text-sm text-slate-200 shadow-xl shadow-slate-950/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/[0.09] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex min-w-0 items-center gap-3">
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
