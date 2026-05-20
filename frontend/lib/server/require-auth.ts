import { redirect } from "next/navigation";

import { getSafeReturnPath } from "../safe-redirect";
import { getAuthenticatedUser } from "./auth";

export async function requireAuthenticatedUser(nextPath: string) {
  const user = await getAuthenticatedUser();

  if (!user) redirect(`/sign-in?next=${encodeURIComponent(getSafeReturnPath(nextPath))}`);

  return user;
}
