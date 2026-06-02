import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getServerEnv } from "./env";
import { createRequestLogger, type RequestLogger } from "./logger";

export async function createAuthClient(log?: RequestLogger) {
  const cookieStore = await cookies();
  const supabaseUrl = getServerEnv("NEXT_PUBLIC_SUPABASE_URL") ?? getServerEnv("SUPABASE_URL");
  const supabaseKey = getServerEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    ?? getServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseKey) {
    (log ?? createRequestLogger("server.auth")).error("auth.client.unavailable", {
      errorCategory: "auth_failure",
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseKey: Boolean(supabaseKey),
    });
    return null;
  }

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
        }
      },
    },
  });
}

export async function getAuthenticatedUser(log?: RequestLogger): Promise<User | null> {
  const supabase = await createAuthClient(log);
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    (log ?? createRequestLogger("server.auth")).error("auth.get_user.failed", {
      errorCategory: "auth_failure",
      error,
    });
    return null;
  }

  return data.user;
}
