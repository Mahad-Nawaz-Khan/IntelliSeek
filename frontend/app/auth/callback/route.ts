import { NextResponse } from "next/server";

import { getSafeReturnPath } from "../../../lib/safe-redirect";
import { createAuthClient } from "../../../lib/server/auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeReturnPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createAuthClient();
    const { error } = supabase
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: new Error("Supabase Auth is not configured") };

    if (!error) {
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  // Keep ?next so a retry (e.g. the sign-in page's provider buttons) drops the
  // user on the page they originally asked for instead of the default.
  const signInUrl = new URL("/sign-in", requestUrl.origin);
  signInUrl.searchParams.set("error", "auth_callback_failed");
  signInUrl.searchParams.set("next", next);
  return NextResponse.redirect(signInUrl);
}
