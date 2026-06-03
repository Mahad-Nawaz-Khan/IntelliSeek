"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import Link from "next/link";

import { useTheme } from "../../context/ThemeContext";

type DemoSignupModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
};

const defaultTitle = "Unlock the full IntelliSeek experience";
const defaultMessage = "Create a free account to upload your own notes, save chat history, and enjoy unlimited questions.";
const limitTitle = "You've reached the demo limit";
const limitMessage = "You've asked 5 questions. Sign up for free to continue chatting, upload your own documents, and save your chat history.";

export function DemoSignupModal({ isOpen, onClose, title, message }: DemoSignupModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm hover:cursor-pointer"
        onClick={onClose}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onClose();
            e.stopPropagation();
          }
        }}
      />
      <div
        className={`relative z-10 w-full max-w-md rounded-[2rem] border p-6 shadow-2xl sm:p-8 ${
          isDark
            ? "border-white/10 bg-slate-900/95 shadow-slate-950/50"
            : "border-slate-200 bg-white/95 shadow-slate-950/10"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="demo-modal-title"
              className={`text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
            >
              {title ?? defaultTitle}
            </h2>
            <p className={`mt-2 text-sm leading-6 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {message ?? defaultMessage}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition ${
              isDark
                ? "text-slate-400 hover:bg-white/10 hover:text-white"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            }`}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 hover:cursor-pointer"
            onClick={onClose}
          >
            Get Started Free
          </Link>
          <Link
            href="/sign-in"
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
              isDark
                ? "border-white/10 bg-white/[0.06] text-slate-100 hover:bg-white/10"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            } hover:cursor-pointer`}
            onClick={onClose}
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DemoLimitModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <DemoSignupModal isOpen={isOpen} onClose={onClose} title={limitTitle} message={limitMessage} />;
}
