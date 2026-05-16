import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isConfigured(value: string | undefined) {
  return Boolean(value && !value.startsWith("your-"));
}

export function hasSupabasePublicConfig() {
  return isConfigured(supabaseUrl) && isConfigured(supabasePublicKey);
}

export const supabase = hasSupabasePublicConfig()
  ? createBrowserClient(supabaseUrl!, supabasePublicKey!)
  : null;
