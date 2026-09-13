import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeReturnPath, isProtectedPath } from "./lib/safe-redirect";

function redirectToSignIn(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/sign-in";
  redirectUrl.searchParams.set("next", getSafeReturnPath(`${request.nextUrl.pathname}${request.nextUrl.search}`));
  return NextResponse.redirect(redirectUrl);
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const isProtected = isProtectedPath(request.nextUrl.pathname);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return isProtected ? redirectToSignIn(request) : response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // `getUser()` verified the JWT with a round-trip to the Auth server on every
  // navigation. `getClaims()` verifies the signature locally against the
  // project's cached JWKS and only falls back to the network when the key is
  // unknown or the project still signs with a legacy symmetric secret. This
  // check is a redirect convenience; route handlers and layouts re-verify the
  // session server-side.
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims && isProtected) return redirectToSignIn(request);

  return response;
}

export const config = {
  matcher: ["/((?!api|auth/callback|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
