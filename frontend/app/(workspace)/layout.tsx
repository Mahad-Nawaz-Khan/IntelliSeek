import type { ReactNode } from "react";

import { WorkspaceShell } from "../../components/workspace/WorkspaceShell";
import { requireAuthenticatedUser } from "../../lib/server/require-auth";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  await requireAuthenticatedUser("/chat");

  return <WorkspaceShell>{children}</WorkspaceShell>;
}
