"use client";

import { Bell, Moon, Sparkles, Sun, Upload, UserCircle } from "lucide-react";

import { useTheme } from "../../context/ThemeContext";
import { PrimaryButton } from "../ui/PrimaryButton";

type ChatHeaderProps = {
  onOpenUpload: () => void;
};

export function ChatHeader({ onOpenUpload }: ChatHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header className="flex flex-col gap-4 border-b border-white/10 bg-slate-950/35 px-4 py-4 backdrop-blur-xl sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">IntelliSeek AI</p>
          <h2 className="mt-1 truncate text-lg font-semibold text-white sm:text-xl">Semantic Academic Assistant</h2>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <PrimaryButton type="button" onClick={onOpenUpload} className="h-10 rounded-lg px-3 sm:px-4">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Upload</span>
        </PrimaryButton>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          title={isDark ? "Switch to light theme" : "Switch to dark theme"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Profile"
        >
          <UserCircle className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
