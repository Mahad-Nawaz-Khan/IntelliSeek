import { Sparkles } from "lucide-react";

export const SUGGESTIONS = [
  "Explain recursion",
  "What is a heap?",
  "Difference between stack and queue",
  "Summarize my uploaded notes",
];

type SuggestedQueriesProps = {
  disabled?: boolean;
  onSelect: (question: string) => void;
};

export function SuggestedQueries({ disabled = false, onSelect }: SuggestedQueriesProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200 shadow-lg shadow-cyan-950/30">
        <Sparkles className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
        Ask your academic knowledge base
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Start with a suggested question or ask anything grounded in your uploaded documents.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(suggestion)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 shadow-sm shadow-slate-950/20 backdrop-blur transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
