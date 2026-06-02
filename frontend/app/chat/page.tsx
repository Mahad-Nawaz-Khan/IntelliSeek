import { Suspense } from "react";

import { ChatLayout } from "../../components/ChatLayout";
import { requireAuthenticatedUser } from "../../lib/server/require-auth";

export default async function ChatPage() {
  await requireAuthenticatedUser("/chat");

  return (
    <Suspense fallback={null}>
      <ChatLayout />
    </Suspense>
  );
}
