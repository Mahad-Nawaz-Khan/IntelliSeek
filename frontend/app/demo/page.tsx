"use client";

import { Suspense } from "react";

import { DemoChatLayout } from "../../components/ChatLayout";

export default function DemoChatPage() {
  return (
    <Suspense fallback={null}>
      <DemoChatLayout />
    </Suspense>
  );
}
