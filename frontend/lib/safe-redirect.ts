export const PROTECTED_PREFIXES = ["/chat", "/library", "/settings"] as const;

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function getSafeReturnPath(path: string | null | undefined, fallback = "/chat") {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;

  const [pathname] = path.split(/[?#]/, 1);
  return isProtectedPath(pathname) ? path : fallback;
}
