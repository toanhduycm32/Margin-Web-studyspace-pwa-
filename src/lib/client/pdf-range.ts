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
        const response = await fetch(this.url, {
          headers: { Range: `bytes=${begin}-${end - 1}` },
          credentials: "same-origin", signal: controller.signal, cache: "no-store",
        });
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(detail?.error || `PDF download failed (${response.status}).`);
        }
        const range = response.headers.get("content-range");
        if (response.status !== 206 || range !== `bytes ${begin}-${end - 1}/${this.length}`) {
          throw new Error("Google Drive returned an unexpected PDF byte range. Reopen the PDF and try again.");
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.length !== end - begin) throw new Error("The PDF download was incomplete. Reopen the PDF and try again.");
        if (!controller.signal.aborted) this.onDataRange(begin, bytes);
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
