import "server-only";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PostgREST `or=(...)` filters are built as strings, so any value interpolated
 * into one is a potential filter-injection sink: a stray `,` starts a new
 * filter, `.` starts a new operator, and `%`/`_` change `ilike` semantics.
 *
 * Nothing in this module escapes values — it rejects or strips anything that
 * could change the shape of a filter, so a malicious value degrades recall
 * instead of widening access.
 */

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/**
 * Guards a UUID before it is interpolated into a PostgREST filter string.
 * Throws rather than returning a fallback: a caller that cannot prove the id is
 * well-formed must not run a query whose access scope depends on it.
 */
export function assertUuid(value: string, label = "id"): string {
  if (!isUuid(value)) throw new Error(`Invalid ${label}`);
  return value;
}

export function filterUuids(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(isUuid))];
}

/**
 * The single definition of what a user may read: their own documents plus the
 * shared knowledge base. `userId` is asserted first because an unvalidated value
 * could inject a second filter and widen the very scope this predicate enforces.
 */
export function accessibleDocumentFilter(userId: string): string {
  return `user_id.eq.${assertUuid(userId, "userId")},source_scope.eq.knowledge_base`;
}

/**
 * Reduces a user-supplied search term to characters that carry no meaning to
 * the PostgREST filter grammar or to `ilike` pattern matching. Returns an empty
 * string when nothing usable survives, which callers treat as "skip this term".
 */
export function toSafeLikeTerm(term: string): string {
  const cleaned = term
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.length >= 3 ? cleaned.slice(0, 80) : "";
}
