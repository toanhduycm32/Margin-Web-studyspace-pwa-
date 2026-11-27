import type { PDFDocumentProxy } from "pdfjs-dist";
import type { DocumentSection } from "@/lib/shared/types";
import type { TextPage } from "./extract";

type Marker = { page: number; title: string; source: "outline" | "heading" };
type OutlineItem = { title: string; dest?: string | unknown[] | null; items?: OutlineItem[] };

function cleanTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 110);
}

function fromMarkers(markers: Marker[], pageCount: number): DocumentSection[] {
  const ordered = markers.filter((item) => item.page >= 1 && item.page <= pageCount && item.title)
    .sort((a, b) => a.page - b.page);
  const selected: Marker[] = [];
  for (const marker of ordered) {
    if (selected.length && marker.page === selected.at(-1)!.page) continue;
    selected.push(marker);
    if (selected.length > 80) throw new Error("This PDF has more than 80 major sections. No partial resource was created.");
  }
  if (!selected.length) return [];
  if (selected[0].page > 1) selected.unshift({ page: 1, title: "Opening pages (inferred division)", source: "heading" });
  return selected.map((marker, index) => ({ id: `section-${index + 1}`, title: marker.title,
    startPage: marker.page, endPage: (selected[index + 1]?.page || pageCount + 1) - 1,
    source: marker.title.includes("(inferred division)") ? "inferred" : marker.source }));
}

export function detectHeadingSections(pages: TextPage[]): DocumentSection[] {
  const markers: Marker[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const lines = page.text.split("\n").slice(0, 16).map(cleanTitle).filter(Boolean);
    const heading = lines.find((line) => line.length >= 5 && line.length <= 95 && (
      /^(?:chapter|unit|part|section|chương|phần|bài)\s+(?:\d+|[IVX]+)/i.test(line) ||
      /^\d{1,2}(?:\.\d{1,2})?\s+[A-ZÀ-Ỹ][^.!?]{4,85}$/.test(line)
    ));
    if (!heading || seen.has(heading.toLocaleLowerCase())) continue;
    seen.add(heading.toLocaleLowerCase());
    markers.push({ page: page.page, title: heading, source: "heading" });
  }
  return markers.length ? fromMarkers(markers, pages.length) : [];
}

async function outlineMarkers(pdf: PDFDocumentProxy): Promise<Marker[]> {
  const outline = await pdf.getOutline() as OutlineItem[] | null;
  if (!outline?.length) return [];
  const major = outline.length === 1 && outline[0].items?.length ? outline[0].items! : outline;
  const markers: Marker[] = [];
  for (const item of major) {
    const title = cleanTitle(item.title || "");
    if (!title || !item.dest) continue;
    try {
      const destination = typeof item.dest === "string" ? await pdf.getDestination(item.dest) : item.dest;
      if (!Array.isArray(destination) || destination[0] == null) continue;
      const index = typeof destination[0] === "number" ? destination[0]
        : await pdf.getPageIndex(destination[0] as Parameters<PDFDocumentProxy["getPageIndex"]>[0]);
      if (!Number.isInteger(index) || index < 0) continue;
      markers.push({ page: index + 1, title, source: "outline" });
    } catch { /* A broken PDF bookmark must not block text extraction. */ }
  }
  return markers;
}

export async function documentSections(pdf: PDFDocumentProxy, pages: TextPage[]): Promise<DocumentSection[]> {
  let markers: Marker[] = [];
  try { markers = await outlineMarkers(pdf); } catch { /* Fall back to text headings. */ }
  const fromOutline = markers.length ? fromMarkers(markers, pages.length) : [];
  if (fromOutline.length) return fromOutline;
  const fromText = detectHeadingSections(pages);
  if (fromText.length) return fromText;
  // No source heading evidence: expose the uncertainty instead of inventing chapters.
  const width = Math.max(1, Math.ceil(pages.length / Math.min(8, Math.ceil(pages.length / 12))));
  const result: DocumentSection[] = [];
  for (let start = 1; start <= pages.length; start += width) {
    const end = Math.min(pages.length, start + width - 1);
    result.push({ id: `section-${result.length + 1}`, title: `Pages ${start}–${end} (inferred division)`,
      startPage: start, endPage: end, source: "inferred" });
  }
  return result;
}
