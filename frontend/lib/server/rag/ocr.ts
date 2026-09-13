import "server-only";

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import Groq from "groq-sdk";
import type { PDFParse as PDFParseType } from "pdf-parse";
import type { Worker as TesseractWorker } from "tesseract.js";

import { getServerEnv } from "../env";
import type { RequestLogger } from "../logger";

function getTesseractWorkerPath(): string | undefined {
  try {
    const esmRequire = createRequire(import.meta.url);
    return esmRequire.resolve("tesseract.js/src/worker-script/node/index.js");
  } catch {
    return undefined;
  }
}

async function spawnTesseractWorker(log?: RequestLogger): Promise<TesseractWorker | null> {
  try {
    const tesseract = await import("tesseract.js");
    const workerPath = getTesseractWorkerPath();
    if (workerPath) {
      return await tesseract.createWorker("eng", tesseract.OEM?.LSTM_ONLY ?? 1, { workerPath });
    }
    return await tesseract.createWorker("eng");
  } catch (error) {
    log?.error("ocr.tesseract_spawn.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

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
  const worker = await spawnTesseractWorker(log);
  if (!worker) return "";

  try {
    const result = await worker.recognize(pageBuffer);
    const text = (result.data?.text ?? "").trim();
    log?.info("ocr.tesseract.success", { pageNumber, textLength: text.length });
    return text;
  } catch (error) {
    log?.error("ocr.tesseract.failed", {
      pageNumber,
      error: error instanceof Error ? error.message : String(error),
    });
    return "";
  } finally {
    await worker.terminate().catch(() => {});
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

    const info = await parser.getInfo();
    totalPages = info.total ?? 0;
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

const OCR_BATCH_SIZE = 25;

  log?.info("ocr.pipeline.pages_detected", { totalPages, batchSize: OCR_BATCH_SIZE });

  const pageTexts: string[] = [];

  try {
    for (let startPage = 1; startPage <= totalPages; startPage += OCR_BATCH_SIZE) {
      const endPage = Math.min(startPage + OCR_BATCH_SIZE - 1, totalPages);
      const batchPages: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        batchPages.push(p);
      }

      log?.info("ocr.pipeline.batch_start", { startPage, endPage, count: batchPages.length });

      let screenshot: Awaited<ReturnType<InstanceType<typeof PDFParseType>["getScreenshot"]>> | null = null;
      try {
        screenshot = await parser.getScreenshot({
          partial: batchPages,
          imageBuffer: true,
          scale: 2.0, // High resolution for sharp OCR
        });
      } catch (renderError) {
        log?.error("ocr.batch_render.failed", {
          startPage,
          endPage,
          error: renderError instanceof Error ? renderError.message : String(renderError),
        });
      }

      if (!screenshot?.pages?.length) continue;

      // 1. Concurrently transcribe the batch via Groq Vision
      const groqResults = await Promise.all(
        screenshot.pages.map(async (page) => {
          if (!page.data || page.data.length === 0) {
            return { pageNumber: page.pageNumber, buffer: null, text: null };
          }
          const pageBuffer = Buffer.from(page.data);
          const text = await ocrWithGroqVision(pageBuffer, page.pageNumber, log);
          return { pageNumber: page.pageNumber, buffer: pageBuffer, text };
        }),
      );

      // 2. For any pages in the batch where Groq Vision failed or returned empty, run Tesseract fallback
      for (const item of groqResults) {
        if (!item.buffer) continue;
        let pageText = item.text;

        if (!pageText) {
          log?.info("ocr.pipeline.falling_back_to_tesseract", { pageNumber: item.pageNumber });
          if (!sharedTesseractWorker) {
            sharedTesseractWorker = await spawnTesseractWorker(log);
          }

          if (sharedTesseractWorker) {
            try {
              const result = await sharedTesseractWorker.recognize(item.buffer);
              const tesseractText = (result.data?.text ?? "").trim();
              pageText = tesseractText;
              log?.info("ocr.tesseract.success", { pageNumber: item.pageNumber, textLength: pageText.length });
            } catch (tessError) {
              log?.error("ocr.tesseract.failed", {
                pageNumber: item.pageNumber,
                error: tessError instanceof Error ? tessError.message : String(tessError),
              });
              pageText = "";
            }
          }
        }

        if (pageText) {
          pageTexts.push(pageText);
        }
      }

      // Explicitly dereference screenshot so the ~200MB of image buffers for this batch are freed before the next batch
      screenshot = null;
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
