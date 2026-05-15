export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export function getServerEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("your-")) return null;
  return value;
}

export function requireServerEnv(name: string): string {
  const value = getServerEnv(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
