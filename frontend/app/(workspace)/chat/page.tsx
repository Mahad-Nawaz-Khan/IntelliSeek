"use client";

import { Suspense } from "react";

import { ChatLayout } from "../../../components/ChatLayout";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatLayout embedded />
    </Suspense>
  );
}
