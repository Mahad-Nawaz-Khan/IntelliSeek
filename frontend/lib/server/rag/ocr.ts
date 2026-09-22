import "server-only";

import { createRequire } from "node:module";
import os from "node:os";
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
    const cachePath = os.tmpdir();
    const options: Record<string, unknown> = { cachePath };
    if (workerPath) {
      options.workerPath = workerPath;
    }
    return await tesseract.createWorker("eng", tesseract.OEM?.LSTM_ONLY ?? 1, options);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[OCR Tesseract Spawn Error]: ${errorMsg}`);
    log?.error("ocr.tesseract_spawn.failed", {
      error: errorMsg,
    });
    return null;
  }
}

// The only vision-capable model on Groq as of 2026-09. llama-3.2-*-vision-preview
// was removed from the platform, so the old default 404'd on every call.
const DEFAULT_GROQ_VISION_MODEL = "qwen/qwen3.8-27b";
// Groq's OTPM admission check rejects a request whose *expected* output exceeds
// the org's per-minute output budget (1000 on the free tier) before it even
// runs. Without an explicit max_tokens the model default (1454) fails that
// check, so every page 429s and cascades down to the Tesseract fallback.
const DEFAULT_GROQ_VISION_MAX_TOKENS = 1024;
const OCR_TIMEOUT_MS = 25_000;
// Cloud-vision pages processed at once. Unbounded concurrency over a batch
// trips Groq's RPM/OTPM limits, and the 429s push pages onto lower-quality
// fallbacks that a paced retry would have avoided.
const OCR_PAGE_CONCURRENCY = 3;

function getGroqMaxTokens(): number {
  const raw = getServerEnv("GROQ_VISION_MAX_TOKENS");
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_GROQ_VISION_MAX_TOKENS;
}

/**
 * Maps items through an async function with at most `limit` calls in flight.
 * Results keep input order. Exported for tests.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

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
      // Two retries lets the SDK honor Groq's retry-after on transient 429s
      // instead of immediately demoting the page to a weaker fallback.
      maxRetries: 2,
    });

    const base64Image = pageBuffer.toString("base64");
    const response = await client.chat.completions.create({
      model,
      // Keep the request inside the org's OTPM admission budget; see the
      // DEFAULT_GROQ_VISION_MAX_TOKENS note above.
      max_tokens: getGroqMaxTokens(),
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
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[OCR Groq Vision Error] Page ${pageNumber}: ${errorMsg}`);
    log?.warn("ocr.groq_vision.failed", {
      pageNumber,
      model,
      error: errorMsg,
    });
    return null;
  }
}

/**
 * Attempts text extraction using OpenRouter Vision if OPENROUTER_API_KEY is configured.
 * Serves as a cloud vision alternative when Groq Vision is unavailable or rate-limited.
 */
export async function ocrWithOpenRouter(
  pageBuffer: Buffer,
  pageNumber = 1,
  log?: RequestLogger,
): Promise<string | null> {
  const apiKey = getServerEnv("OPENROUTER_API_KEY");
  if (!apiKey) {
    return null;
  }

  // gemini-2.0-flash-001 was removed from OpenRouter ("No endpoints found"),
  // and paid models stop working when credits run out, so the default is a
  // :free vision model (verified to exist and accept image input).
  const model = getServerEnv("OPENROUTER_VISION_MODEL") ?? "inclusionai/ling-3.0-flash-vl:free";

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey,
      baseURL: getServerEnv("OPENROUTER_BASE_URL") ?? "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": getServerEnv("OPENROUTER_HTTP_REFERER") ?? "http://localhost:3000",
        "X-Title": getServerEnv("OPENROUTER_APP_TITLE") ?? "IntelliSeek",
      },
      timeout: OCR_TIMEOUT_MS,
      maxRetries: 2,
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
              text: "Transcribe all visible text in this document page accurately. Return only the extracted plain text with natural formatting and paragraph breaks. Do not include markdown preamble, commentary, or descriptions of images. If the page is blank or has no readable text, return an empty string.",
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
      log?.info("ocr.openrouter_vision.success", { pageNumber, model, textLength: text.length });
      return text;
    }
    return null;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`[OCR OpenRouter Vision Error] Page ${pageNumber}: ${errorMsg}`);
    log?.warn("ocr.openrouter_vision.failed", { pageNumber, model, error: errorMsg });
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
  console.log(`[OCR Pipeline] Starting OCR text extraction, buffer size: ${buffer.length} bytes`);
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
    console.log(`[OCR Pipeline] PDF loaded: ${totalPages} pages found.`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[OCR Pipeline Error] Failed to load PDF for OCR: ${errorMsg}`);
    log?.error("ocr.pdf_load.failed", {
      error: errorMsg,
    });
    if (parser) {
      await parser.destroy().catch(() => {});
    }
    return "";
  }

  if (totalPages <= 0) {
    console.warn("[OCR Pipeline] No pages found in PDF.");
    log?.warn("ocr.pipeline.no_pages_found");
    if (parser) {
      await parser.destroy().catch(() => {});
    }
    return "";
  }

  // Pages rendered per wave. At scale 2.0 each page PNG can be a few MB, so a
  // 25-page batch would hold ~200MB of buffers for the whole OCR round; 5 keeps
  // memory bounded while still amortizing the pdf.js render call.
  const OCR_BATCH_SIZE = 5;

  log?.info("ocr.pipeline.pages_detected", { totalPages, batchSize: OCR_BATCH_SIZE });

  const pageTexts: string[] = [];

  try {
    for (let startPage = 1; startPage <= totalPages; startPage += OCR_BATCH_SIZE) {
      const endPage = Math.min(startPage + OCR_BATCH_SIZE - 1, totalPages);
      const batchPages: number[] = [];
      for (let p = startPage; p <= endPage; p++) {
        batchPages.push(p);
      }

      console.log(`[OCR Pipeline] Processing batch pages ${startPage}-${endPage} (${batchPages.length} pages)...`);
      log?.info("ocr.pipeline.batch_start", { startPage, endPage, count: batchPages.length });

      let screenshot: Awaited<ReturnType<InstanceType<typeof PDFParseType>["getScreenshot"]>> | null = null;
      try {
        screenshot = await parser.getScreenshot({
          partial: batchPages,
          imageBuffer: true,
          scale: 2.0, // High resolution for sharp OCR
        });
      } catch (renderError) {
        const errorMsg = renderError instanceof Error ? renderError.message : String(renderError);
        console.error(`[OCR Pipeline Error] Batch render failed for pages ${startPage}-${endPage}: ${errorMsg}`);
        log?.error("ocr.batch_render.failed", {
          startPage,
          endPage,
          error: errorMsg,
        });
      }

      if (!screenshot?.pages?.length) {
        console.warn(`[OCR Pipeline] No rendered page images in batch ${startPage}-${endPage}.`);
        continue;
      }

      // 1. Transcribe the batch via Groq Vision (with OpenRouter Vision as the
      // second tier), paced through a small concurrency pool so the provider
      // rate limits are not tripped by a simultaneous burst.
      const visionResults = await mapWithConcurrency(
        screenshot.pages,
        OCR_PAGE_CONCURRENCY,
        async (page) => {
          if (!page.data || page.data.length === 0) {
            return { pageNumber: page.pageNumber, buffer: null, text: null };
          }
          const pageBuffer = Buffer.from(page.data);
          let text = await ocrWithGroqVision(pageBuffer, page.pageNumber, log);
          if (!text) {
            text = await ocrWithOpenRouter(pageBuffer, page.pageNumber, log);
          }
          return { pageNumber: page.pageNumber, buffer: pageBuffer, text };
        },
      );

      // 2. For any pages in the batch where cloud vision failed or returned empty, run Tesseract fallback
      for (const item of visionResults) {
        if (!item.buffer) continue;
        let pageText = item.text;

        if (!pageText) {
          console.log(`[OCR Pipeline] Falling back to Tesseract.js for page ${item.pageNumber}...`);
          log?.info("ocr.pipeline.falling_back_to_tesseract", { pageNumber: item.pageNumber });
          if (!sharedTesseractWorker) {
            sharedTesseractWorker = await spawnTesseractWorker(log);
          }

          if (sharedTesseractWorker) {
            try {
              const result = await sharedTesseractWorker.recognize(item.buffer);
              const tesseractText = (result.data?.text ?? "").trim();
              pageText = tesseractText;
              console.log(`[OCR Pipeline] Page ${item.pageNumber} transcribed via Tesseract (${pageText.length} chars).`);
              log?.info("ocr.tesseract.success", { pageNumber: item.pageNumber, textLength: pageText.length });
            } catch (tessError) {
              const errorMsg = tessError instanceof Error ? tessError.message : String(tessError);
              console.error(`[OCR Pipeline Error] Tesseract failed on page ${item.pageNumber}: ${errorMsg}`);
              log?.error("ocr.tesseract.failed", {
                pageNumber: item.pageNumber,
                error: errorMsg,
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
  console.log(`[OCR Pipeline] Completed. Extracted ${pageTexts.length}/${totalPages} pages (${combinedText.length} total characters).`);
  log?.info("ocr.pipeline.complete", {
    totalPages,
    pagesWithText: pageTexts.length,
    totalTextLength: combinedText.length,
  });

  return combinedText;
}
