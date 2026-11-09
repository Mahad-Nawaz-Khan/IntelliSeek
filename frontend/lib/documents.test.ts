import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteDocumentById,
  fetchAccessibleDocuments,
  invalidateDocumentsCache,
  toKnowledgeSource,
} from "./documents";

describe("documents client & optimistic cache invalidation", () => {
  beforeEach(() => {
    invalidateDocumentsCache();
    vi.restoreAllMocks();
  });

  it("maps DocumentRow to KnowledgeSource accurately", () => {
    const source = toKnowledgeSource({
      id: "doc-1",
      filename: "DSA_Notes.pdf",
      processing_status: "indexed",
      source_scope: "personal",
    });

    expect(source).toEqual({
      id: "doc-1",
      filename: "DSA_Notes.pdf",
      sourceType: "uploaded",
      fileType: "pdf",
      status: "indexed",
      createdAt: undefined,
      summary: undefined,
    });
  });

  it("invalidates the deduplication cache immediately when a document is deleted", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          documents: [{ id: "doc-1", filename: "Lecture1.pdf", processing_status: "indexed" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          documents: [],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const initial = await fetchAccessibleDocuments();
    expect(initial).toHaveLength(1);

    // Delete invalidates cache and calls DELETE /api/documents
    await deleteDocumentById("doc-1");

    // Subsequent fetch must not return the stale cached list
    const afterDelete = await fetchAccessibleDocuments();
    expect(afterDelete).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws when DELETE /api/documents returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ ok: false, error: "Document not found" }),
      }),
    );

    await expect(deleteDocumentById("missing-id")).rejects.toThrow("Document not found");
  });
});
