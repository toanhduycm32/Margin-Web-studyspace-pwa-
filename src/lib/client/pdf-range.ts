import { getDocument, GlobalWorkerOptions, PDFDataRangeTransport } from "pdfjs-dist/legacy/build/pdf.mjs";

const CHUNK_SIZE = 1024 * 1024;

export class DrivePdfRangeTransport extends PDFDataRangeTransport {
  private readonly controllers = new Set<AbortController>();
  private failed = false;

  constructor(private readonly url: string, length: number, private readonly onFailure: (error: Error) => void) {
    super(length, null);
  }

  requestDataRange(begin: number, end: number): void {
    if (this.failed) return;
    const controller = new AbortController();
    this.controllers.add(controller);
    void (async () => {
      try {
        // PDF.js may merge adjacent missing chunks into a much larger request.
        // Keep each HTTP response bounded, then deliver its original exact range.
        const combined = new Uint8Array(end - begin);
        for (let offset = begin; offset < end; offset += CHUNK_SIZE) {
          const partEnd = Math.min(end, offset + CHUNK_SIZE);
          const response = await fetch(this.url, {
            headers: { Range: `bytes=${offset}-${partEnd - 1}` },
            credentials: "same-origin", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]), cache: "no-store",
          });
          if (!response.ok) {
            const detail = await response.json().catch(() => null) as { error?: string } | null;
            throw new Error(detail?.error || `PDF download failed (${response.status}).`);
          }
          const range = response.headers.get("content-range");
          if (response.status !== 206 || range !== `bytes ${offset}-${partEnd - 1}/${this.length}`) {
            throw new Error("Google Drive returned an unexpected PDF byte range. Reopen the PDF and try again.");
          }
          const bytes = new Uint8Array(await response.arrayBuffer());
          if (bytes.length !== partEnd - offset) throw new Error("The PDF download was incomplete. Reopen the PDF and try again.");
          combined.set(bytes, offset - begin);
        }
        if (!controller.signal.aborted) this.onDataRange(begin, combined);
      } catch (caught) {
        if (!controller.signal.aborted && !this.failed) {
          this.failed = true;
          this.onFailure(caught instanceof Error ? caught : new Error("Could not download this PDF."));
        }
      } finally {
        this.controllers.delete(controller);
      }
    })();
  }

  abort(): void {
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }
}

export function openDrivePdf(id: string, size: number, onFailure: (error: Error) => void) {
  if (!Number.isSafeInteger(size) || size < 1) throw new Error("Google Drive did not provide the PDF size.");
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const transport = new DrivePdfRangeTransport(`/api/library/${encodeURIComponent(id)}/file`, size, onFailure);
  const task = getDocument({ range: transport, disableStream: true, disableAutoFetch: true,
    rangeChunkSize: CHUNK_SIZE });
  return task;
}
