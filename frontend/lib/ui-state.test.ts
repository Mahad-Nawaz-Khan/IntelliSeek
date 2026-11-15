import { describe, expect, it } from "vitest";

import {
  computeSectionSelectionResult,
  computeSourceToggleResult,
  formatSourcesButtonLabel,
  getSelectedSources,
  hasPersonalUploadedSources,
  isSelectableSource,
  isSourcesResolved,
  shouldShowWelcomeUploadCta,
  type KnowledgeSource,
} from "./ui-state";

function makeSource(overrides: Partial<KnowledgeSource> = {}): KnowledgeSource {
  return {
    id: "doc-1",
    filename: "notes.pdf",
    sourceType: "uploaded",
    status: "indexed",
    ...overrides,
  };
}

describe("ui-state welcome upload visibility", () => {
  it("hides the welcome upload CTA by default while loading or unavailable", () => {
    expect(isSourcesResolved("loading")).toBe(false);
    expect(isSourcesResolved("unavailable")).toBe(false);

    expect(
      shouldShowWelcomeUploadCta({
        sourceStatus: "loading",
        hasPersonalSources: false,
      }),
    ).toBe(false);

    expect(
      shouldShowWelcomeUploadCta({
        sourceStatus: "unavailable",
        hasPersonalSources: false,
      }),
    ).toBe(false);
  });

  it("shows the welcome upload CTA only after fetch completes with no personal uploaded documents", () => {
    expect(
      shouldShowWelcomeUploadCta({
        sourceStatus: "empty",
        hasPersonalSources: false,
      }),
    ).toBe(true);

    // Only shared Knowledge Base documents exist (no personal uploads)
    const kbOnly = [makeSource({ sourceType: "knowledge-base" })];
    expect(hasPersonalUploadedSources(kbOnly)).toBe(false);
    expect(
      shouldShowWelcomeUploadCta({
        sourceStatus: "ready",
        hasPersonalSources: hasPersonalUploadedSources(kbOnly),
      }),
    ).toBe(true);
  });

  it("keeps the welcome upload CTA hidden when the user already has uploaded or indexing documents", () => {
    for (const status of ["indexed", "indexing", "available"] as const) {
      const userDocs = [makeSource({ status })];
      expect(hasPersonalUploadedSources(userDocs)).toBe(true);
      expect(
        shouldShowWelcomeUploadCta({
          sourceStatus: "ready",
          hasPersonalSources: hasPersonalUploadedSources(userDocs),
        }),
      ).toBe(false);
    }
  });

  it("shows the CTA again if only failed personal uploads remain or in non-demo non-temp mode", () => {
    const failedOnly = [makeSource({ status: "failed" })];
    expect(hasPersonalUploadedSources(failedOnly)).toBe(false);
    expect(
      shouldShowWelcomeUploadCta({
        sourceStatus: "ready",
        hasPersonalSources: hasPersonalUploadedSources(failedOnly),
      }),
    ).toBe(true);

    expect(
      shouldShowWelcomeUploadCta({
        sourceStatus: "empty",
        hasPersonalSources: false,
        isDemo: true,
      }),
    ).toBe(false);

    expect(
      shouldShowWelcomeUploadCta({
        sourceStatus: "empty",
        hasPersonalSources: false,
        isTemporaryChat: true,
      }),
    ).toBe(false);
  });
});

describe("ui-state source selection", () => {
  it("treats non-failed documents as selectable and excludes failed uploads", () => {
    expect(isSelectableSource(makeSource({ status: "indexed" }))).toBe(true);
    expect(isSelectableSource(makeSource({ status: "indexing" }))).toBe(true);
    expect(isSelectableSource(makeSource({ status: "available" }))).toBe(true);
    expect(isSelectableSource(makeSource({ status: "failed" }))).toBe(false);
  });

  it("filters selected sources by excluded IDs, failed status, and includeKnowledgeBase", () => {
    const sources = [
      makeSource({ id: "u1", sourceType: "uploaded", status: "indexed" }),
      makeSource({ id: "u2", sourceType: "uploaded", status: "indexing" }),
      makeSource({ id: "u-failed", sourceType: "uploaded", status: "failed" }),
      makeSource({ id: "kb1", sourceType: "knowledge-base", status: "indexed" }),
      makeSource({ id: "kb2", sourceType: "knowledge-base", status: "indexed" }),
    ];

    expect(getSelectedSources(sources, [], true).map((s) => s.id)).toEqual(["u1", "u2", "kb1", "kb2"]);
    expect(getSelectedSources(sources, ["u2", "kb1"], true).map((s) => s.id)).toEqual(["u1", "kb2"]);
    expect(getSelectedSources(sources, ["u2"], false).map((s) => s.id)).toEqual(["u1"]);
  });

  it("formats singular and plural source count labels", () => {
    expect(formatSourcesButtonLabel(0)).toBe("0 Sources");
    expect(formatSourcesButtonLabel(1)).toBe("1 Source");
    expect(formatSourcesButtonLabel(2)).toBe("2 Sources");
  });

  it("computes single-source toggle exclusions and KB re-enable accurately", () => {
    const sources = [
      makeSource({ id: "u1", sourceType: "uploaded", status: "indexed" }),
      makeSource({ id: "kb1", sourceType: "knowledge-base", status: "indexed" }),
      makeSource({ id: "kb2", sourceType: "knowledge-base", status: "indexed" }),
      makeSource({ id: "kb-failed", sourceType: "knowledge-base", status: "failed" }),
    ];

    expect(computeSourceToggleResult(sources, [], "u1", true)).toEqual({
      excludedSourceIds: ["u1"],
      enableKnowledgeBase: false,
    });
    expect(computeSourceToggleResult(sources, ["u1"], "u1", true)).toEqual({
      excludedSourceIds: [],
      enableKnowledgeBase: false,
    });
    expect(computeSourceToggleResult(sources, ["u1"], "kb1", false)).toEqual({
      excludedSourceIds: ["u1", "kb2"],
      enableKnowledgeBase: true,
    });
  });

  it("computes section selection toggles for uploaded and knowledge-base groups", () => {
    const sources = [
      makeSource({ id: "u1", sourceType: "uploaded", status: "indexed" }),
      makeSource({ id: "u2", sourceType: "uploaded", status: "indexed" }),
      makeSource({ id: "kb1", sourceType: "knowledge-base", status: "indexed" }),
      makeSource({ id: "kb2", sourceType: "knowledge-base", status: "indexed" }),
    ];

    expect(computeSectionSelectionResult(sources, ["kb1"], "uploaded", false, true)).toEqual({
      excludedSourceIds: ["kb1", "u1", "u2"],
      enableKnowledgeBase: false,
    });
    expect(computeSectionSelectionResult(sources, ["kb1", "u1"], "uploaded", true, true)).toEqual({
      excludedSourceIds: ["kb1"],
      enableKnowledgeBase: false,
    });
    expect(computeSectionSelectionResult(sources, ["kb1"], "knowledge-base", true, false)).toEqual({
      excludedSourceIds: [],
      enableKnowledgeBase: true,
    });
  });
});
