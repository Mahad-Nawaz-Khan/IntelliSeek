import type { SupabaseClient } from "@supabase/supabase-js";
import { getSafeReturnPath } from "./safe-redirect";

export type OAuthProvider = "google" | "github";

type StartProviderAuthOptions = {
  supabase: SupabaseClient;
  provider: OAuthProvider;
  /** Verified in-app path to land on after the sign-in completes. */
  next: string;
  /** Called when the session exists and the user should be moved on. */
  onAuthenticated: () => void;
  onError: (message: string) => void;
  /** Resets pending button state; runs after every outcome. */
  onSettled: () => void;
};

const POPUP_NAME = "intelliseek-oauth";
const POPUP_FEATURES = "popup=true,width=520,height=720";
const POPUP_TIMEOUT_MS = 300_000;
const POLL_INTERVAL_MS = 400;

/**
 * Starts a Google/GitHub sign-in.
 *
 * On desktop the provider runs in a popup, so the provider's pages (its
 * account chooser in particular) never enter the tab's browser history —
 * pressing Back after signing in can no longer land on them. The opener tab
 * stays put and navigates once the popup reports a session. On touch-sized
 * screens popups are hostile, so the flow falls back to a full-page redirect;
 * location.replace() keeps the login page itself out of the history stack.
 */
export async function startProviderAuth({
  supabase,
  provider,
  next,
  onAuthenticated,
  onError,
  onSettled,
}: StartProviderAuthOptions): Promise<void> {
  const targetUrl = getSafeReturnPath(next);
  const usePopup = window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 640;

  // Opened synchronously inside the click gesture: awaiting the SDK call first
  // would break the user-activation chain and let popup blockers win.
  const popup = usePopup ? window.open("about:blank", POPUP_NAME, POPUP_FEATURES) : null;
  const redirectTo =
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(targetUrl)}` +
    (popup ? "&popup=1" : "");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    popup?.close();
    onError(error?.message ?? `Could not start ${provider} sign-in.`);
    onSettled();
    return;
  }

  if (!popup) {
    window.location.replace(data.url);
    return;
  }

  popup.location.href = data.url;

  const startedAt = Date.now();
  let settled = false;

  const triggerAuthSuccess = () => {
    if (settled) return;
    settled = true;
    cleanup();
    try {
      popup.close();
    } catch {
      // Best effort close
    }
    onAuthenticated();
    onSettled();

    // Auto refresh the entire webpage to guarantee cookies and server components re-sync
    window.location.assign(targetUrl);
  };

  const handleMessage = (event: MessageEvent) => {
    if (
      event.origin === window.location.origin &&
      (event.data?.type === "OAUTH_COMPLETE" || event.data?.type === "OAUTH_AUTH_COMPLETE")
    ) {
      triggerAuthSuccess();
    }
  };

  window.addEventListener("message", handleMessage);

  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
      triggerAuthSuccess();
    }
  });

  const cleanup = () => {
    window.clearInterval(poll);
    window.removeEventListener("message", handleMessage);
    authListener.subscription.unsubscribe();
  };

  const poll = window.setInterval(async () => {
    if (settled) return;

    try {
      const { data } = await supabase.auth.getSession();
      if (!settled && data?.session) {
        triggerAuthSuccess();
        return;
      }
    } catch {
      // Ignore transient errors
    }

    if (settled) return;

    if (popup.closed) {
      window.clearInterval(poll);
      // Popup closed: brief wait for cookies/storage to settle before reading session
      setTimeout(async () => {
        if (settled) return;
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            triggerAuthSuccess();
            return;
          }
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session) {
            triggerAuthSuccess();
            return;
          }
        } catch {
          // Fall through to error
        }

        if (!settled) {
          settled = true;
          cleanup();
          onError("Sign-in was cancelled before it finished.");
          onSettled();
        }
      }, 350);
      return;
    }

    if (Date.now() - startedAt > POPUP_TIMEOUT_MS) {
      settled = true;
      cleanup();
      try {
        popup.close();
      } catch {
        // Ignore
      }
      onError("Sign-in took too long. Please try again.");
      onSettled();
    }
  }, POLL_INTERVAL_MS);
}
