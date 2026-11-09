"use client";

import {
  AlignJustify,
  ArrowDownCircle,
  CornerDownLeft,
  LogOut,
  Moon,
  Quote,
  RotateCcw,
  Settings,
  Shield,
  Sun,
  UserCircle,
} from "lucide-react";

import { useWorkspaceOptional } from "../../../components/workspace/WorkspaceShell";
import { useAuth } from "../../../context/AuthContext";
import { useTheme } from "../../../context/ThemeContext";
import { usePreferences } from "../../../lib/preferences";

type ToggleRowProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  badgeText: string;
  onToggle: () => void;
};

function PreferenceToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  badgeText,
  onToggle,
}: Readonly<ToggleRowProps>) {
  return (
    <article className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/25 backdrop-blur-xl transition hover:border-cyan-300/25">
      <div>
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20">
            <Icon className="h-5 w-5" />
          </span>
          <div className="flex items-center gap-2.5">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                checked
                  ? "border-cyan-300/30 bg-cyan-300/12 text-cyan-100"
                  : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              {badgeText}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={checked}
              aria-label={`Toggle ${title}`}
              onClick={onToggle}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
                checked
                  ? "border-cyan-300/50 bg-cyan-400"
                  : "border-white/15 bg-slate-800/80"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full transition-transform duration-200 ${
                  checked ? "translate-x-5.5 bg-slate-950" : "translate-x-1 bg-slate-300"
                }`}
              />
            </button>
          </div>
        </div>
        <h2 className="mt-4 font-semibold text-white">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </article>
  );
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { preferences, updatePreference, resetPreferences } = usePreferences();
  const workspace = useWorkspaceOptional();

  const isDark = theme === "dark";
  const indexedCount = workspace
    ? workspace.sources.filter((s) => s.status === "indexed").length
    : null;

  return (
    <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="rounded-4xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/20">
                <Settings className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Preferences</p>
                <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Settings</h1>
              </div>
            </div>

            <button
              type="button"
              onClick={resetPreferences}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/30 hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset to defaults
            </button>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
            Customize your IntelliSeek workspace appearance, citation display, and chat composer behavior. Preferences are saved automatically to your browser.
          </p>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <PreferenceToggleCard
            icon={isDark ? Moon : Sun}
            title="Dark academic theme"
            description="High-contrast dark slate canvas designed for extended reading and late-night study sessions."
            checked={isDark}
            badgeText={isDark ? "Dark mode" : "Light mode"}
            onToggle={toggleTheme}
          />

          <PreferenceToggleCard
            icon={Quote}
            title="Citation previews"
            description="Show rich source tooltips with filename and chunk ranges when hovering or focusing citation chips."
            checked={preferences.citationPreviews}
            badgeText={preferences.citationPreviews ? "Enabled" : "Compact"}
            onToggle={() => updatePreference("citationPreviews", !preferences.citationPreviews)}
          />

          <PreferenceToggleCard
            icon={CornerDownLeft}
            title="Press Enter to send"
            description="When enabled, Enter submits your question and Shift+Enter adds a new line. When off, use Ctrl+Enter to send."
            checked={preferences.sendOnEnter}
            badgeText={preferences.sendOnEnter ? "Enter" : "Ctrl+Enter"}
            onToggle={() => updatePreference("sendOnEnter", !preferences.sendOnEnter)}
          />

          <PreferenceToggleCard
            icon={AlignJustify}
            title="Compact message density"
            description="Tighter spacing and typography in chat conversations so more exchanges fit on screen at once."
            checked={preferences.compactMessages}
            badgeText={preferences.compactMessages ? "Compact" : "Comfortable"}
            onToggle={() => updatePreference("compactMessages", !preferences.compactMessages)}
          />

          <PreferenceToggleCard
            icon={ArrowDownCircle}
            title="Auto-follow streaming answers"
            description="Automatically keep the latest streamed text in view while IntelliSeek generates an answer."
            checked={preferences.autoScrollOnStream}
            badgeText={preferences.autoScrollOnStream ? "Enabled" : "Manual"}
            onToggle={() => updatePreference("autoScrollOnStream", !preferences.autoScrollOnStream)}
          />

          <article className="flex flex-col justify-between rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/25 backdrop-blur-xl">
            <div>
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20">
                  <Shield className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-0.5 text-xs font-medium text-emerald-200">
                  Protected
                </span>
              </div>
              <h2 className="mt-4 font-semibold text-white">Workspace privacy & isolation</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Your personal documents are tenant-isolated to your account and never used to train external language models.
              </p>
            </div>
          </article>
        </section>

        {/* Account Summary Card */}
        <section className="mt-6 rounded-4xl border border-white/10 bg-slate-950/55 p-6 shadow-xl shadow-slate-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/15 text-base font-semibold text-cyan-200 ring-1 ring-cyan-300/25">
                {user?.email ? user.email.charAt(0).toUpperCase() : <UserCircle className="h-6 w-6" />}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold text-white">
                    {user?.email ?? "IntelliSeek User"}
                  </h2>
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider text-cyan-200">
                    {workspace?.isAdmin ? "Admin" : "Academic Member"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {indexedCount !== null
                    ? `${indexedCount} indexed source${indexedCount === 1 ? "" : "s"} available for retrieval`
                    : "Authenticated workspace session"}
                </p>
              </div>
            </div>

            {user && (
              <button
                type="button"
                onClick={signOut}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-xs font-semibold text-red-100 transition hover:bg-red-400/20"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
