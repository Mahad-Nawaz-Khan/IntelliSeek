import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import mammoth from "mammoth";

import { extractScannedPdfText, isScannedPdfText } from "./ocr";

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const worker = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");

  PDFParse.setWorker(pathToFileURL(worker.getPath()).href);

  const parser = new PDFParse({
    data: buffer,
    CanvasFactory: worker.CanvasFactory,
  });
  let text = "";
  try {
    const result = await parser.getText();
    text = result.text ?? "";
  } finally {
    await parser.destroy();
  }

  if (isScannedPdfText(text)) {
    return extractScannedPdfText(buffer);
  }

  return text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.values(zip.files)
    .filter((file) => /^ppt\/slides\/slide\d+\.xml$/.test(file.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  // Limit processing to 250 slides to prevent zip bomb resource exhaustion
  const targetSlides = slideFiles.slice(0, 250);
  const slides: string[] = [];

  for (const file of targetSlides) {
    const xml = await file.async("string");
    // Cap individual slide XML to 2MB to prevent decompression memory spikes
    if (xml.length > 2_000_000) continue;
    const matches = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)];
    const text = matches.map((match) => decodeXmlText(match[1])).join(" ").trim();
    if (text) slides.push(text);
  }

  return slides.join("\n\n");
}

export async function extractTextFromBuffer(
  arrayBuffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const buffer = Buffer.from(arrayBuffer);

  if (extension === ".txt" || extension === ".md" || mimeType === "text/plain" || mimeType === "text/markdown") {
    return new TextDecoder("utf-8").decode(arrayBuffer);
  }

  if (extension === ".pdf" || mimeType === "application/pdf") {
    return extractPdfText(buffer);
  }

  if (
    extension === ".docx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(buffer);
  }

  if (
    extension === ".pptx" ||
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    return extractPptxText(buffer);
  }

  throw new Error(`Unsupported file type: ${extension || mimeType}`);
}
