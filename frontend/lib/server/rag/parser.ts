import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
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

  const slides = await Promise.all(
    slideFiles.map(async (file) => {
      const xml = await file.async("string");
      const matches = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)];
      return matches.map((match) => decodeXmlText(match[1])).join(" ");
    }),
  );

  return slides.filter(Boolean).join("\n\n");
}

export async function extractTextFromBuffer(
  arrayBuffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  const buffer = Buffer.from(arrayBuffer);

  if (extension === ".txt" || mimeType === "text/plain") {
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
