import { describe, expect, it } from "vitest";

import type { SourceCitation } from "./chat-api";
import {
  groupSourceCitations,
  normalizeSourceCitations,
  selectCitedSources,
} from "./source-citations";

let nextChunkId = 0;

function cited(filename: string, chunk_index: number, document_id = "doc-1"): SourceCitation {
  nextChunkId += 1;
  return { document_id, filename, chunk_id: `chunk-${nextChunkId}`, chunk_index };
}

describe("normalizeSourceCitations", () => {
  it("drops entries the model may have fabricated", () => {
    const good = cited("notes.pdf", 0);
    expect(
      normalizeSourceCitations([null, "notes.pdf", { document_id: "d" }, { ...good, chunk_index: "0" }, good]),
    ).toEqual([good]);
  });

  it("dedupes on document and chunk, keeping the first sighting", () => {
    const first = cited("notes.pdf", 0);
    const duplicate = { ...first };
    expect(normalizeSourceCitations([first, duplicate])).toEqual([first]);
  });

  it("caps the list at maxSources", () => {
    const many = Array.from({ length: 15 }, (_, index) => cited("notes.pdf", index));
    expect(normalizeSourceCitations(many)).toHaveLength(12);
    expect(normalizeSourceCitations(many, 2)).toHaveLength(2);
  });
});

describe("selectCitedSources", () => {
  it("narrows to the files the answer actually cites", () => {
    const notes = cited("notes.pdf", 0);
    const slides = cited("slides.pptx", 2, "doc-2");
    expect(selectCitedSources("As notes.pdf explains, the tree is balanced.", [notes, slides])).toEqual([notes]);
  });

  it("does not count lecture-notes.pdf as citing notes.pdf", () => {
    const notes = cited("notes.pdf", 0);
    const lecture = cited("lecture-notes.pdf", 0, "doc-3");
    expect(selectCitedSources("lecture-notes.pdf covers this in detail.", [notes, lecture])).toEqual([lecture]);
  });

  it("matches bare stems for files like Chapter 3.pdf", () => {
    const chapter = cited("Chapter 3.pdf", 4);
    const other = cited("other.pdf", 1, "doc-4");
    expect(selectCitedSources("See [Chapter 3] for the proof.", [chapter, other])).toEqual([chapter]);
  });

  it("ignores short stems that collide with ordinary prose", () => {
    const short = cited("a1.pdf", 0);
    const other = cited("other.pdf", 1, "doc-5");
    expect(selectCitedSources("a1 is a tiny identifier.", [short, other])).toEqual([short, other]);
  });

  it("returns the full set when nothing is cited or the answer is empty", () => {
    const sources = [cited("notes.pdf", 0)];
    expect(selectCitedSources("The proof follows from the definition.", sources)).toBe(sources);
    expect(selectCitedSources("", sources)).toBe(sources);
  });
});

describe("groupSourceCitations", () => {
  it("groups by document and renders contiguous chunk ranges", () => {
    const grouped = groupSourceCitations([
      cited("notes.pdf", 0),
      cited("notes.pdf", 1),
      cited("notes.pdf", 3),
      cited("slides.pptx", 7, "doc-2"),
    ]);
    expect(grouped.map((group) => [group.filename, group.chunkRanges])).toEqual([
      ["notes.pdf", "Chunks 1-2, 4"],
      ["slides.pptx", "Chunk 8"],
    ]);
  });

  it("normalizes before grouping", () => {
    const valid = cited("notes.pdf", 2);
    const grouped = groupSourceCitations([valid, { ...valid }, null as unknown as SourceCitation]);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.sources).toEqual([valid]);
    expect(grouped[0]?.chunkRanges).toBe("Chunk 3");
  });
});
