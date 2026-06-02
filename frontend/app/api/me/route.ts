import { getAuthenticatedUser } from "../../../lib/server/auth";
import { getUserRole } from "../../../lib/server/roles";

export const runtime = "nodejs";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return Response.json({ ok: false, error: "Sign in is required" }, { status: 401 });

  return Response.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: getUserRole(user),
    },
  });
}
