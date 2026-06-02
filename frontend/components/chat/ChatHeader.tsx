"use client";

import { Moon, Sun, Upload } from "lucide-react";

import { useTheme } from "../../context/ThemeContext";
import { PrimaryButton } from "../ui/PrimaryButton";

type ChatHeaderProps = {
  onOpenUpload: () => void;
};

export function ChatHeader({ onOpenUpload }: ChatHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header className="flex flex-col gap-4  px-4 pt-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">IntelliSeek AI</p>
        <h2 className="mt-1 text-xl font-semibold text-white">Semantic Academic Assistant</h2>
      </div>
      <div className="flex items-center gap-2">
        <PrimaryButton type="button" onClick={onOpenUpload} className="px-3 sm:px-4">
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
      </div>
    </header>
  );
}
