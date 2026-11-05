"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { getSafeReturnPath } from "../../../lib/safe-redirect";

function AuthCompleteContent() {
  const searchParams = useSearchParams();
  const next = getSafeReturnPath(searchParams.get("next"));

  useEffect(() => {
    // 1. Notify opener tab and instruct it to refresh into the target route
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "OAUTH_COMPLETE", next }, window.location.origin);
        if (window.opener.location) {
          window.opener.location.href = next;
        }
      }
    } catch {
      // Ignore if cross-origin or restricted handle
    }

    // 2. Close this popup window
    const timer = window.setTimeout(() => {
      window.close();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [next]);

  return (
    <main className="auth-page flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <div className="max-w-sm rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <h1 className="text-xl font-semibold">Signed in</h1>
        <p className="mt-3 text-sm text-slate-300">
          You can close this window and return to IntelliSeek.
        </p>
        <Link
          href={next}
          className="mt-6 inline-flex rounded-2xl bg-cyan-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
        >
          Continue to IntelliSeek
        </Link>
      </div>
    </main>
  );
}

export default function AuthCompletePage() {
  return (
    <Suspense fallback={null}>
      <AuthCompleteContent />
    </Suspense>
  );
}
