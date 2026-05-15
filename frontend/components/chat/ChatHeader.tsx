import { Bell, Moon, Upload, UserCircle } from "lucide-react";

import { PrimaryButton } from "../ui/PrimaryButton";

type ChatHeaderProps = {
  onOpenUpload: () => void;
};

export function ChatHeader({ onOpenUpload }: ChatHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
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
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Dark theme enabled"
        >
          <Moon className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Profile"
        >
          <UserCircle className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
