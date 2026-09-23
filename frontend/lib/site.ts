/**
 * Single source of truth for site identity, used by metadata, robots,
 * sitemap, the manifest, and structured data. Override the URL for custom
 * domains via NEXT_PUBLIC_SITE_URL.
 */
export const SITE_NAME = "IntelliSeek";
export const SITE_TAGLINE = "Understand Your Notes With AI";

export const SITE_DESCRIPTION =
  "IntelliSeek turns your lecture notes, slides, and PDFs into an AI study assistant — semantic search across your material, source-grounded answers with citations, and instant document indexing.";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (fromEnv && !fromEnv.startsWith("your-") ? fromEnv : "https://intelliseek-ai.vercel.app").replace(/\/$/, "");
}
