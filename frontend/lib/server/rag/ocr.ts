import "server-only";

import { pathToFileURL } from "node:url";
import Groq from "groq-sdk";
import type { PDFParse as PDFParseType } from "pdf-parse";
import type { Worker as TesseractWorker } from "tesseract.js";

import { getServerEnv } from "../env";
import type { RequestLogger } from "../logger";

const DEFAULT_GROQ_VISION_MODEL = "llama-3.2-11b-vision-preview";
const OCR_TIMEOUT_MS = 25_000;

/**
 * Checks if the text extracted by native pdf-parse is essentially empty or consists
 * solely of pagination markers like "-- 1 of 11 --".
 */
export function isScannedPdfText(text: string): boolean {
  if (!text || !text.trim()) return true;
  const stripped = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "").trim();
  return stripped.length === 0;
}

/**
 * Renders each page of a PDF document into a high-resolution PNG image buffer.
 */
export async function renderPdfPagesToImages(
  buffer: Buffer,
  log?: RequestLogger,
): Promise<Buffer[]> {
  try {
    const worker = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");

    PDFParse.setWorker(pathToFileURL(worker.getPath()).href);

    const parser = new PDFParse({
      data: buffer,
      CanvasFactory: worker.CanvasFactory,
    });

    try {
      const screenshot = await parser.getScreenshot({
        imageBuffer: true,
        scale: 2.0, // Scale 2.0 produces sharp text rendering for OCR accuracy
      });
      return screenshot.pages.map((p) => Buffer.from(p.data));
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    log?.error("ocr.render_pages.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Attempts text extraction for an image buffer using Groq Vision.
 * Returns null if Groq fails, is not configured, or if the model was deprecated/unavailable.
 */
export async function ocrWithGroqVision(
  pageBuffer: Buffer,
  pageNumber = 1,
  log?: RequestLogger,
): Promise<string | null> {
  const apiKey = getServerEnv("GROQ_API_KEY");
  if (!apiKey) {
    log?.info("ocr.groq_vision.skipped", { reason: "GROQ_API_KEY not configured", pageNumber });
    return null;
  }

  const model = getServerEnv("GROQ_VISION_MODEL") ?? DEFAULT_GROQ_VISION_MODEL;

  try {
    const client = new Groq({
      apiKey,
      timeout: OCR_TIMEOUT_MS,
      maxRetries: 1,
    });

    const base64Image = pageBuffer.toString("base64");
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract and transcribe all text from this scanned document page verbatim. Preserve headings, layout, and structure where applicable. Output ONLY the extracted text with no conversational preamble or conversational ending.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    if (text) {
      log?.info("ocr.groq_vision.success", { pageNumber, model, textLength: text.length });
      return text;
    }
    log?.warn("ocr.groq_vision.empty_response", { pageNumber, model });
    return null;
  } catch (error) {
    log?.warn("ocr.groq_vision.failed", {
      pageNumber,
      model,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Local OCR fallback using Tesseract.js WebAssembly.
 * Fully self-contained, runs offline with zero external API dependencies.
 */
export async function ocrWithTesseract(
  pageBuffer: Buffer,
  pageNumber = 1,
  log?: RequestLogger,
): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const result = await worker.recognize(pageBuffer);
      const text = result.data.text.trim();
      log?.info("ocr.tesseract.success", { pageNumber, textLength: text.length });
      return text;
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    log?.error("ocr.tesseract.failed", {
      pageNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  }
}

/**
 * End-to-end OCR pipeline for scanned PDFs.
 * Processes pages sequentially in turns (page-by-page streaming) so only ONE
 * page image resides in memory at a time. This allows documents of any length
 * to be processed without risk of Out-Of-Memory (OOM) crashes.
 */
export async function extractScannedPdfText(
  buffer: Buffer,
  log?: RequestLogger,
): Promise<string> {
  log?.info("ocr.pipeline.start", { bufferSize: buffer.length });

  // Lazily initialized Tesseract worker shared across pages if fallback is needed
  let sharedTesseractWorker: TesseractWorker | null = null;
  let parser: InstanceType<typeof PDFParseType> | null = null;
  let totalPages = 0;

  try {
    const worker = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");

    PDFParse.setWorker(pathToFileURL(worker.getPath()).href);

    parser = new PDFParse({
      data: buffer,
      CanvasFactory: worker.CanvasFactory,
    });

    const info = await parser.load();
    totalPages = info.numPages ?? 0;
  } catch (error) {
    log?.error("ocr.pdf_load.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (parser) {
      await parser.destroy().catch(() => {});
    }
    return "";
  }

  if (totalPages <= 0) {
    log?.warn("ocr.pipeline.no_pages_found");
    if (parser) {
      await parser.destroy().catch(() => {});
    }
    return "";
  }

  log?.info("ocr.pipeline.pages_detected", { totalPages });

  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      // 1. Render ONLY this single page in memory
      let pageBuffer: Buffer | null = null;
      try {
        const screenshot = await parser.getScreenshot({
          partial: [pageNumber],
          imageBuffer: true,
          scale: 2.0, // High resolution for sharp OCR
        });
        const rawData = screenshot.pages?.[0]?.data;
        if (rawData && rawData.length > 0) {
          pageBuffer = Buffer.from(rawData);
        }
      } catch (renderError) {
        log?.error("ocr.page_render.failed", {
          pageNumber,
          error: renderError instanceof Error ? renderError.message : String(renderError),
        });
      }

      if (!pageBuffer) continue;

      // 2. Try Groq Vision first for this page
      let pageText = await ocrWithGroqVision(pageBuffer, pageNumber, log);

      // 3. If Groq Vision fails or is unavailable, fall back to Tesseract
      if (!pageText) {
        log?.info("ocr.pipeline.falling_back_to_tesseract", { pageNumber });
        if (!sharedTesseractWorker) {
          const { createWorker } = await import("tesseract.js");
          sharedTesseractWorker = await createWorker("eng");
        }

        try {
          const result = await sharedTesseractWorker.recognize(pageBuffer);
          const tesseractText = (result.data?.text ?? "").trim();
          pageText = tesseractText;
          log?.info("ocr.tesseract.success", { pageNumber, textLength: tesseractText.length });
        } catch (tessError) {
          log?.error("ocr.tesseract.failed", {
            pageNumber,
            error: tessError instanceof Error ? tessError.message : String(tessError),
          });
          pageText = "";
        }
      }

      if (pageText) {
        pageTexts.push(pageText);
      }

      // Explicitly dereference the buffer so memory is immediately reclaimed by GC
      pageBuffer = null;
    }
  } finally {
    if (parser) {
      await parser.destroy().catch(() => {});
    }
    if (sharedTesseractWorker) {
      await sharedTesseractWorker.terminate().catch(() => {});
    }
  }

  const combinedText = pageTexts.join("\n\n");
  log?.info("ocr.pipeline.complete", {
    totalPages,
    pagesWithText: pageTexts.length,
    totalTextLength: combinedText.length,
  });

  return combinedText;
}
