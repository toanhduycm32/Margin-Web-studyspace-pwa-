import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentSection } from "@/lib/shared/types";

export type TextPage = { page: number; text: string };
export type TextChunk = { startPage: number; endPage: number; text: string; emptyPages: number[]; section?: DocumentSection };

export const MAX_CHUNK_CHARACTERS = 45_000;
export const MAX_CHUNKS = 80;

type PdfTextItems = Awaited<ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["getTextContent"]>>["items"];

export function extractPageText(items: PdfTextItems): string {
  const lines: string[] = [];
  let line = "";
  for (const item of items) {
    if (!("str" in item)) continue;
    const piece = item.str.replace(/[\t ]+/g, " ");
    if (piece.trim()) line += `${line && !/\s$/.test(line) && !/^\s/.test(piece) ? " " : ""}${piece}`;
    if (item.hasEOL) { if (line.trim()) lines.push(line.trim()); line = ""; }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join("\n");
}

function appendPage(chunks: TextChunk[], current: TextChunk | null, page: TextPage): TextChunk {
  const readable = page.text.replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim()).filter(Boolean).join("\n");
  const part = `Page ${page.page}\n${readable || "[No extractable text]"}`;
  if (part.length > MAX_CHUNK_CHARACTERS) throw new Error(`Page ${page.page} contains too much text to process safely.`);
  if (current && current.text.length + part.length + 2 > MAX_CHUNK_CHARACTERS) {
    chunks.push(current); current = null;
  }
  if (!current) {
    if (chunks.length >= MAX_CHUNKS) throw new Error("This PDF exceeds the current whole-document processing capacity. No partial artifact was created.");
    current = { startPage: page.page, endPage: page.page, text: "", emptyPages: [] };
  }
  current.endPage = page.page;
  current.text += `${current.text ? "\n\n" : ""}${part}`;
  if (!readable) current.emptyPages.push(page.page);
  return current;
}

export function partitionPages(pages: TextPage[]): TextChunk[] {
  if (!pages.length || pages.length > 5000) throw new Error("PDF page count is unsupported.");
  const chunks: TextChunk[] = [];
  let current: TextChunk | null = null;
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index];
    if (page.page !== index + 1) throw new Error("PDF page extraction is incomplete.");
    current = appendPage(chunks, current, page);
  }
  if (current) chunks.push(current);
  return chunks;
}

export function partitionSectionPages(pages: TextPage[], sections: DocumentSection[]): TextChunk[] {
  if (!sections.length || sections[0].startPage !== 1 || sections.at(-1)?.endPage !== pages.length) {
    throw new Error("Document section coverage is incomplete.");
  }
  const chunks: TextChunk[] = [];
  let current: TextChunk | null = null;
  let sectionIndex = 0;
  for (const page of pages) {
    while (page.page > sections[sectionIndex].endPage) {
      if (current) chunks.push(current);
      current = null; sectionIndex++;
    }
    const section = sections[sectionIndex];
    if (page.page < section.startPage || page.page > section.endPage) throw new Error("Document section coverage is inconsistent.");
    const next = appendPage(chunks, current, page);
    next.section = section;
    current = next;
  }
  if (current) chunks.push(current);
  if (chunks.length > MAX_CHUNKS) throw new Error("This PDF has too many processing segments. No partial artifact was created.");
  return chunks;
}

export async function extractTextPages(pdf: PDFDocumentProxy, onProgress: (page: number, total: number) => void,
  signal?: AbortSignal): Promise<TextPage[]> {
  if (pdf.numPages < 1 || pdf.numPages > 5000) throw new Error("This PDF's page count is unsupported.");
  const pages: TextPage[] = [];
  for (let number = 1; number <= pdf.numPages; number++) {
    if (signal?.aborted) throw new Error("Processing stopped.");
    let text: string;
    try {
      const pdfPage = await pdf.getPage(number);
      text = extractPageText((await pdfPage.getTextContent()).items);
    } catch { throw new Error(`Text extraction failed on page ${number}. No partial resource was saved.`); }
    pages.push({ page: number, text });
    onProgress(number, pdf.numPages);
    if (number % 4 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return pages;
}

export async function extractWholePdf(pdf: PDFDocumentProxy, onProgress: (page: number, total: number) => void,
  signal?: AbortSignal): Promise<TextChunk[]> {
  return partitionPages(await extractTextPages(pdf, onProgress, signal));
}
