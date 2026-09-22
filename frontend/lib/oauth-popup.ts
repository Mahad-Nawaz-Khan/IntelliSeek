import type { SupabaseClient } from "@supabase/supabase-js";

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
const POPUP_TIMEOUT_MS = 120_000;

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
  const usePopup = window.matchMedia("(pointer: fine)").matches && window.innerWidth >= 640;

  // Opened synchronously inside the click gesture: awaiting the SDK call first
  // would break the user-activation chain and let popup blockers win.
  const popup = usePopup ? window.open("about:blank", POPUP_NAME, POPUP_FEATURES) : null;
  const redirectTo =
    `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` +
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
  const poll = window.setInterval(() => {
    if (!popup.closed) {
      if (Date.now() - startedAt > POPUP_TIMEOUT_MS) {
        window.clearInterval(poll);
        popup.close();
        onError("Sign-in took too long. Please try again.");
        onSettled();
      }
      return;
    }

    window.clearInterval(poll);
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        onAuthenticated();
      } else {
        onError("Sign-in was cancelled before it finished.");
      }
      onSettled();
    });
  }, 400);
}
