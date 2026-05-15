import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function hasSupabasePublicConfig() {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl !== "your-supabase-url" &&
      supabaseAnonKey !== "your-supabase-anon-key",
  );
}

export const supabase = hasSupabasePublicConfig()
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
