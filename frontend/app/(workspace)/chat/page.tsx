"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { ChatLayout } from "../../../components/ChatLayout";

export default function ChatPage() {
  const searchParams = useSearchParams();
  const sessionKey = searchParams.get("session") ?? "new";

  return (
    <Suspense fallback={null}>
      <ChatLayout key={sessionKey} embedded />
    </Suspense>
  );
}
