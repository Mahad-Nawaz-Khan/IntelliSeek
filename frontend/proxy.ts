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
  const { pathname } = request.nextUrl;
  const isProtected = isProtectedPath(pathname);
  // Pages that only make sense signed out. An authenticated visitor is
  // redirected here, before the page renders, so the marketing page never
  // flashes and a browser Back press cannot resurface the login screens.
  const isAuthOnlyPage =
    pathname === "/" || pathname === "/sign-in" || pathname === "/sign-up";
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
  async function resolveClaims() {
    try {
      // data null with no error means no session cookie at all; an error (or a
      // thrown JWKS/network failure) means a session may exist but the local
      // verification could not complete.
      const { data, error } = await supabase.auth.getClaims();
      if (data?.claims) return { claims: data.claims, recoverable: false };
      return { claims: null, recoverable: Boolean(error) };
    } catch {
      return { claims: null, recoverable: true };
    }
  }

  const { claims: initialClaims, recoverable } = await resolveClaims();
  let claims = initialClaims;

  if (!claims && recoverable && (isProtected || isAuthOnlyPage)) {
    // getUser() verifies against the Auth server and renews an expired session
    // via the refresh token; the setAll above then persists the refreshed
    // cookies on the response. Without this, a transient verification failure
    // would bounce a signed-in user to the login page.
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      ({ claims } = await resolveClaims());
    }
  }

  const isAuthenticated = Boolean(claims);

  if (!isAuthenticated) {
    if (isProtected) return redirectToSignIn(request);
    return response;
  }

  if (isAuthOnlyPage) {
    const target = getSafeReturnPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(target, request.nextUrl.origin));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|auth/callback|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
