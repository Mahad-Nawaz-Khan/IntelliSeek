import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getServerEnv } from "./env";

let client: SupabaseClient | null | undefined;

export function getSupabaseServiceClient(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = getServerEnv("SUPABASE_URL") ?? getServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getServerEnv("SUPABASE_SERVICE_KEY");

  client = url && serviceKey ? createClient(url, serviceKey) : null;
  return client;
}
