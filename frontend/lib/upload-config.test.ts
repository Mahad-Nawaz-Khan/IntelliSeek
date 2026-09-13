import { describe, expect, it } from "vitest";

import { isAllowedFile, MAX_FILE_SIZE } from "./upload-config";

function file(name: string, type: string, size = 1024): File {
  const created = new File([new Uint8Array(8)], name, { type });
  if (created.size !== size) Object.defineProperty(created, "size", { value: size });
  return created;
}

describe("isAllowedFile", () => {
  it("accepts a confident match between extension and reported type", () => {
    expect(isAllowedFile(file("lecture.pdf", "application/pdf")).valid).toBe(true);
  });

  it("accepts unknown or generic browser reports for Office files", () => {
    expect(isAllowedFile(file("notes.docx", "")).valid).toBe(true);
    expect(isAllowedFile(file("notes.docx", "application/octet-stream")).valid).toBe(true);
  });

  it("accepts either text type for text and markdown files", () => {
    expect(isAllowedFile(file("notes.txt", "text/markdown")).valid).toBe(true);
    expect(isAllowedFile(file("notes.md", "text/plain")).valid).toBe(true);
  });

  it("rejects a confident mismatch between type and extension", () => {
    const mismatch = isAllowedFile(file("malware.pdf", "image/png"));
    expect(mismatch.valid).toBe(false);
    expect(mismatch.error).toContain("does not match the .pdf extension");
    expect(isAllowedFile(file("notes.pdf", "text/plain")).valid).toBe(false);
  });

  it("normalizes case and whitespace before comparing", () => {
    expect(isAllowedFile(file("lecture.pdf", " APPLICATION/PDF ")).valid).toBe(true);
  });

  it("rejects unsupported or missing extensions", () => {
    expect(isAllowedFile(file("virus.exe", "application/octet-stream")).error).toContain(
      "Unsupported file type",
    );
    expect(isAllowedFile(file("noext", "text/plain")).error).toBe("Unsupported file type: none");
  });

  it("rejects files above the size cap", () => {
    const tooBig = isAllowedFile(file("huge.pdf", "application/pdf", MAX_FILE_SIZE + 1));
    expect(tooBig.valid).toBe(false);
    expect(tooBig.error).toContain("File too large");
  });
});
