import "server-only";

const GENERIC_ERROR_MESSAGE = "The assistant could not answer this question. Please try again.";

/**
 * Messages that are safe to show a user verbatim. Everything thrown inside the
 * answer pipeline is written for operators — it names providers, tables,
 * environment variables, and Supabase error text — so the default is to replace
 * it rather than to sanitise it. Adding a message here is a deliberate decision
 * that it explains something the user can act on and discloses nothing about how
 * the system is built.
 */
const CLIENT_SAFE_MESSAGES = new Set([
  "Chat session was not found",
  "Cannot embed blank text",
]);

export function toClientErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return GENERIC_ERROR_MESSAGE;
  return CLIENT_SAFE_MESSAGES.has(error.message) ? error.message : GENERIC_ERROR_MESSAGE;
}
