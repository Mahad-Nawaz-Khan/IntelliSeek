import type { Metadata } from "next";
import type { ReactNode } from "react";

import { WorkspaceShell } from "../../components/workspace/WorkspaceShell";
import { requireAuthenticatedUser } from "../../lib/server/require-auth";

// The workspace sits behind sign-in, so search engines get nothing to index.
export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser("/chat");

  return <WorkspaceShell>{children}</WorkspaceShell>;
}
