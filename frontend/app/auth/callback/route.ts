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
      // Popup flows land here in the popup window; send them to a page that
      // closes itself instead of loading the workspace inside the popup. The
      // opener tab has been polling its session and navigates on its own.
      if (requestUrl.searchParams.get("popup") === "1") {
        return NextResponse.redirect(new URL("/auth/complete", requestUrl.origin));
      }
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
