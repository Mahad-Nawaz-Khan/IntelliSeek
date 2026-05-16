import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { getServerEnv } from "./env";

export async function createAuthClient() {
  const cookieStore = await cookies();
  const supabaseUrl = getServerEnv("NEXT_PUBLIC_SUPABASE_URL") ?? getServerEnv("SUPABASE_URL");
  const supabaseKey = getServerEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!supabaseUrl || !supabaseKey) return null;

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createAuthClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;

  return data.user;
}
