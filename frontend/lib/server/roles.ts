import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "user";

function metadataHasAdminRole(metadata: Record<string, unknown> | null | undefined) {
  const role = metadata?.role;
  const roles = metadata?.roles;
  return role === "admin" || (Array.isArray(roles) && roles.includes("admin"));
}

export function getUserRole(user: User | null | undefined): AppRole {
  if (!user) return "user";
  return metadataHasAdminRole(user.app_metadata) || metadataHasAdminRole(user.user_metadata) ? "admin" : "user";
}

export function isAdminUser(user: User | null | undefined) {
  return getUserRole(user) === "admin";
}
