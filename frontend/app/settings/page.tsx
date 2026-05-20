import { Bell, Moon, Shield, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { requireAuthenticatedUser } from "../../lib/server/require-auth";

const settings = [
  {
    title: "Dark academic theme",
    description: "Enabled by default for the current presentation build.",
    icon: Moon,
    status: "Enabled",
  },
  {
    title: "Citation previews",
    description: "Show compact source context when preview text exists.",
    icon: Bell,
    status: "Enabled",
  },
  {
    title: "Retrieval tuning",
    description: "Top-K and source matching controls are coming soon.",
    icon: SlidersHorizontal,
    status: "Coming soon",
  },
  {
    title: "Workspace privacy",
    description: "Server-only secrets remain outside browser-readable configuration.",
    icon: Shield,
    status: "Protected",
  },
];

export default async function SettingsPage() {
  await requireAuthenticatedUser("/settings");

  return (
    <main className="academic-page-shell min-h-screen px-4 py-8 text-slate-100 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-5xl">
        <Link href="/chat" className="text-sm text-cyan-200 transition hover:text-cyan-100">← Back to assistant</Link>
        <header className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">Preferences</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Settings</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Presentation-ready preferences for IntelliSeek. Unimplemented controls are shown as coming soon instead of broken interactions.</p>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {settings.map((item) => {
            const Icon = item.icon;
            const disabled = item.status === "Coming soon";
            return (
              <article key={item.title} className={`rounded-3xl border p-5 shadow-xl shadow-slate-950/25 backdrop-blur-xl ${disabled ? "border-white/10 bg-white/[0.035] opacity-70" : "border-white/10 bg-white/[0.06]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-200">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-300">{item.status}</span>
                </div>
                <h2 className="mt-4 font-semibold text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
