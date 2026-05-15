"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ChatInputProps = {
  disabled?: boolean;
  onSubmit: (question: string) => void;
};

export function ChatInput({ disabled = false, onSubmit }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  function submit() {
    const question = value.trim();
    if (!question || disabled) return;

    onSubmit(question);
    setValue("");
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-3 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl transition-colors focus-within:border-cyan-400/50">
      <div className="flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          disabled={disabled}
          placeholder="Ask IntelliSeek about your uploaded material..."
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-3 py-3 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          aria-label="Send question"
        >
          <Send className="h-5 w-5" />
        </button>
      </div>
      <p className="px-3 pt-2 text-xs text-slate-500">
        Press Enter to send, Shift+Enter for a new line.
      </p>
    </div>
  );
}
