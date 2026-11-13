"use client";

import { MessageCircleDashed, Moon, Sun, Upload } from "lucide-react";

import { useTheme } from "../../context/ThemeContext";
import { PrimaryButton } from "../ui/PrimaryButton";

type ChatHeaderProps = {
  onOpenUpload: () => void;
  isTemporaryChat?: boolean;
  onToggleTemporaryChat?: () => void;
};

export function ChatHeader({
  onOpenUpload,
  isTemporaryChat = false,
  onToggleTemporaryChat,
}: Readonly<ChatHeaderProps>) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header className="hidden flex-col gap-4 px-4 pt-4 md:flex md:flex-row md:items-center md:justify-between md:px-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">IntelliSeek AI</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Semantic Academic Assistant</h2>
      </div>
      <div className="flex items-center gap-2">
        <PrimaryButton type="button" onClick={onOpenUpload} className="px-3 md:px-4">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Upload</span>
        </PrimaryButton>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        {onToggleTemporaryChat && (
          <button
            type="button"
            onClick={onToggleTemporaryChat}
            aria-pressed={isTemporaryChat}
            aria-label={isTemporaryChat ? "Exit temporary chat" : "Temporary chat"}
            title={
              isTemporaryChat
                ? "Temporary chat active — messages aren't saved. Click to exit."
                : "Temporary chat — messages won't be saved to history"
            }
            className={`inline-flex h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-semibold transition hover:cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
              isTemporaryChat
                ? "border-dashed border-cyan-300/60 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/20"
                : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <MessageCircleDashed className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Temporary chat</span>
          </button>
        )}
      </div>
    </header>
  );
}
