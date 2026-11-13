import { describe, expect, it } from "vitest";

import {
  accessibleDocumentFilter,
  applyDocumentScopeFilter,
  assertUuid,
  filterUuids,
  isUuid,
  toSafeLikeTerm,
} from "./postgrest-safe";

const USER_ID = "0b7f9c1e-6f2a-4c3d-9a1b-2f8e7d6c5b4a";

describe("isUuid", () => {
  it("accepts canonical and uppercase forms", () => {
    expect(isUuid("0b7f9c1e-6f2a-4c3d-9a1b-2f8e7d6c5b4a")).toBe(true);
    expect(isUuid("0B7F9C1E-6F2A-4C3D-9A1B-2F8E7D6C5B4A")).toBe(true);
  });

  it("rejects values that could change the shape of a PostgREST filter", () => {
    expect(isUuid("")).toBe(false);
    expect(isUuid("0b7f9c1e6f2a4c3d9a1b2f8e7d6c5b4a")).toBe(false);
    expect(isUuid("{0b7f9c1e-6f2a-4c3d-9a1b-2f8e7d6c5b4a}")).toBe(false);
    expect(isUuid("0b7f9c1e-6f2a-4c3d-9a1b-2f8e7d6c5b4z")).toBe(false);
    expect(isUuid("00000000-0000-4000-8000-00000000000,role.eq.admin")).toBe(false);
  });
});

describe("assertUuid", () => {
  it("returns the value unchanged when it is a UUID", () => {
    expect(assertUuid(USER_ID, "userId")).toBe(USER_ID);
  });

  it("throws with the caller's label", () => {
    expect(() => assertUuid("not-a-uuid", "userId")).toThrow("Invalid userId");
    expect(() => assertUuid("not-a-uuid")).toThrow("Invalid id");
  });
});

describe("filterUuids", () => {
  it("trims, dedupes, and drops malformed ids", () => {
    expect(filterUuids([`  ${USER_ID}  `, USER_ID, "junk", ""])).toEqual([USER_ID]);
  });
});

describe("accessibleDocumentFilter", () => {
  it("scopes reads to the user's documents plus the knowledge base", () => {
    expect(accessibleDocumentFilter(USER_ID)).toBe(
      `user_id.eq.${USER_ID},source_scope.eq.knowledge_base`,
    );
  });

  it("refuses to interpolate a value that could widen the scope", () => {
    expect(() => accessibleDocumentFilter("x,role.eq.admin")).toThrow("Invalid userId");
  });
});

describe("applyDocumentScopeFilter", () => {
  function createMockQuery() {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query = {
      or(...args: unknown[]) {
        calls.push({ method: "or", args });
        return query;
      },
      eq(...args: unknown[]) {
        calls.push({ method: "eq", args });
        return query;
      },
    };
    return { query, calls };
  }

  it("includes personal and knowledge_base documents when Knowledge Base is enabled", () => {
    const { query, calls } = createMockQuery();
    applyDocumentScopeFilter(query, USER_ID, true);
    expect(calls).toEqual([
      { method: "or", args: [`user_id.eq.${USER_ID},source_scope.eq.knowledge_base`] },
    ]);
  });

  it("restricts to personal documents owned by the user when Knowledge Base is disabled", () => {
    const { query, calls } = createMockQuery();
    applyDocumentScopeFilter(query, USER_ID, false);
    expect(calls).toEqual([
      { method: "eq", args: ["user_id", USER_ID] },
      { method: "eq", args: ["source_scope", "personal"] },
    ]);
  });

  it("applies foreignTable scoping for embedded documents queries", () => {
    const { query: kbEnabledQuery, calls: kbEnabledCalls } = createMockQuery();
    applyDocumentScopeFilter(kbEnabledQuery, USER_ID, true, { foreignTable: "documents" });
    expect(kbEnabledCalls).toEqual([
      {
        method: "or",
        args: [
          `user_id.eq.${USER_ID},source_scope.eq.knowledge_base`,
          { foreignTable: "documents" },
        ],
      },
    ]);

    const { query: kbDisabledQuery, calls: kbDisabledCalls } = createMockQuery();
    applyDocumentScopeFilter(kbDisabledQuery, USER_ID, false, { foreignTable: "documents" });
    expect(kbDisabledCalls).toEqual([
      { method: "eq", args: ["documents.user_id", USER_ID] },
      { method: "eq", args: ["documents.source_scope", "personal"] },
    ]);
  });

  it("rejects invalid userId values in both modes", () => {
    const { query } = createMockQuery();
    expect(() => applyDocumentScopeFilter(query, "bad-id", false)).toThrow("Invalid userId");
  });
});

describe("toSafeLikeTerm", () => {
  it("keeps letters, numbers, whitespace, and hyphens", () => {
    expect(toSafeLikeTerm("  state-space   search ")).toBe("state-space search");
  });

  it("replaces filter and ilike metacharacters with separators", () => {
    expect(toSafeLikeTerm("100%_done")).toBe("100 done");
  });

  it("drops terms too short to be worth a query", () => {
    expect(toSafeLikeTerm("ab")).toBe("");
    expect(toSafeLikeTerm("(),.")).toBe("");
  });

  it("caps the term at 80 characters", () => {
    expect(toSafeLikeTerm("a".repeat(120))).toHaveLength(80);
  });
});
