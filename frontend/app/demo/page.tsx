"use client";

import { Suspense } from "react";

import { ChatLayout } from "../../components/ChatLayout";

export default function DemoChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatLayout demo />
    </Suspense>
  );
}
