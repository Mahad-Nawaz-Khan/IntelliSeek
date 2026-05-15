import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function hasSupabasePublicConfig() {
  return Boolean(
    supabaseUrl &&
      supabasePublishableKey &&
      supabaseUrl !== "your-supabase-url" &&
      supabasePublishableKey !== "your-supabase-publishable-key",
  );
}

export const supabase = hasSupabasePublicConfig()
  ? createClient(supabaseUrl!, supabasePublishableKey!)
  : null;
