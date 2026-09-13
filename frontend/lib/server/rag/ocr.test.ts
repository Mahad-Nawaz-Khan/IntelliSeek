import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGroqCreate = vi.fn();
const mockCreateWorker = vi.fn();

vi.mock("groq-sdk", () => ({
  default: class MockGroq {
    chat = {
      completions: {
        create: mockGroqCreate,
      },
    };
  },
}));

vi.mock("tesseract.js", () => ({
  createWorker: mockCreateWorker,
}));

import {
  extractScannedPdfText,
  isScannedPdfText,
  ocrWithGroqVision,
  ocrWithTesseract,
  renderPdfPagesToImages,
} from "./ocr";

describe("isScannedPdfText", () => {
  it("returns true for empty or whitespace strings", () => {
    expect(isScannedPdfText("")).toBe(true);
    expect(isScannedPdfText("   \n\t  ")).toBe(true);
  });

  it("returns true when text contains only pagination markers", () => {
    const markersOnly = "-- 1 of 11 --\n-- 2 of 11 --\n-- 3 of 11 --";
    expect(isScannedPdfText(markersOnly)).toBe(true);

    const spacedMarkers = "--   1   of   5   --\n\n--   2   of   5   --";
    expect(isScannedPdfText(spacedMarkers)).toBe(true);
  });

  it("returns false when actual content is present", () => {
    const normalPdfText = "Introduction to Data Structures\nArrays and Linked Lists";
    expect(isScannedPdfText(normalPdfText)).toBe(false);

    const textWithMarkers = "Executive Summary\nThis is real content.\n-- 1 of 5 --";
    expect(isScannedPdfText(textWithMarkers)).toBe(false);
  });
});

describe("renderPdfPagesToImages", () => {
  it("returns an empty array when given an invalid or corrupt buffer", async () => {
    const corruptBuffer = Buffer.from("corrupt-non-pdf-data");
    const pages = await renderPdfPagesToImages(corruptBuffer);
    expect(pages).toEqual([]);
  });
});

describe("ocrWithGroqVision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when GROQ_API_KEY is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const result = await ocrWithGroqVision(Buffer.from("dummy"));
    expect(result).toBeNull();
  });

  it("returns transcribed text when Groq Vision returns completion", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-mock-key");
    mockGroqCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Transcribed lab report content from page image",
          },
        },
      ],
    });

    const result = await ocrWithGroqVision(Buffer.from("fake-png-bytes"));
    expect(result).toBe("Transcribed lab report content from page image");
    expect(mockGroqCreate).toHaveBeenCalledTimes(1);
  });

  it("gracefully catches Groq errors and returns null instead of throwing", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-mock-key");
    mockGroqCreate.mockRejectedValueOnce(new Error("Model deprecated or 404"));

    const result = await ocrWithGroqVision(Buffer.from("fake-png-bytes"));
    expect(result).toBeNull();
  });
});

describe("ocrWithTesseract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns recognized text when Tesseract succeeds", async () => {
    mockCreateWorker.mockResolvedValueOnce({
      recognize: vi.fn().mockResolvedValue({
        data: { text: "Tesseract fallback text output" },
      }),
      terminate: vi.fn().mockResolvedValue(undefined),
    });

    const result = await ocrWithTesseract(Buffer.from("fake-img"));
    expect(result).toBe("Tesseract fallback text output");
  });

  it("returns empty string and catches errors when Tesseract fails", async () => {
    mockCreateWorker.mockRejectedValueOnce(new Error("Wasm initialization error"));

    const result = await ocrWithTesseract(Buffer.from("fake-img"));
    expect(result).toBe("");
  });
});

describe("extractScannedPdfText", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns empty string when no pages can be rendered", async () => {
    const result = await extractScannedPdfText(Buffer.from("corrupt-pdf"));
    expect(result).toBe("");
  });

  it("extracts text via Groq Vision when valid PDF and Groq succeeds", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-mock-key");
    mockGroqCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "Extracted Page 1 via Groq Vision",
          },
        },
      ],
    });

    const minimalPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF",
    );

    const result = await extractScannedPdfText(minimalPdf);
    expect(result).toBe("Extracted Page 1 via Groq Vision");
    expect(mockGroqCreate).toHaveBeenCalledTimes(1);
    expect(mockCreateWorker).not.toHaveBeenCalled();
  });

  it("falls back to Tesseract when Groq Vision fails", async () => {
    vi.stubEnv("GROQ_API_KEY", "gsk-mock-key");
    mockGroqCreate.mockRejectedValueOnce(new Error("Groq 404 model removed"));

    mockCreateWorker.mockResolvedValueOnce({
      recognize: vi.fn().mockResolvedValue({
        data: { text: "Extracted Page 1 via Tesseract Fallback" },
      }),
      terminate: vi.fn().mockResolvedValue(undefined),
    });

    const minimalPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 300 144]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF",
    );

    const result = await extractScannedPdfText(minimalPdf);
    expect(result).toBe("Extracted Page 1 via Tesseract Fallback");
    expect(mockGroqCreate).toHaveBeenCalledTimes(1);
    expect(mockCreateWorker).toHaveBeenCalledWith("eng");
  });
});
