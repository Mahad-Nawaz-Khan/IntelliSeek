"use client";

import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { ChatLayout } from "../../../components/ChatLayout";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const sessionKey = searchParams.get("session") ?? "new";

  return (
    <Suspense
      fallback={
        <main className="academic-page-shell flex min-h-dvh items-center justify-center bg-slate-950 text-slate-100">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-slate-300" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-300" />
            Opening your workspace…
          </div>
        </main>
      }
    >
      <ChatLayout key={sessionKey} embedded />
    </Suspense>
  );
}
