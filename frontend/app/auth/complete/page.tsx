"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Landing spot for the OAuth popup after the code exchange succeeds. The
 * window was opened by script, so window.close() is permitted; the message is
 * only visible if the browser refuses to close it.
 */
export default function AuthCompletePage() {
  useEffect(() => {
    window.close();
  }, []);

  return (
    <main className="auth-page flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-xl font-semibold">Signed in</h1>
        <p className="mt-3 text-sm text-slate-300">
          You can close this window and return to IntelliSeek.
        </p>
        <Link
          href="/chat"
          className="mt-6 inline-flex rounded-2xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Continue to IntelliSeek
        </Link>
      </div>
    </main>
  );
}
