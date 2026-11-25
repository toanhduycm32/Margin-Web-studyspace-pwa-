"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

function PageSurface({ pdf, number, width, active }: {
  pdf: PDFDocumentProxy; number: number; width: number; active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState(1.41);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<unknown> } | null = null;
    async function render() {
      try {
        const page = await pdf.getPage(number);
        if (cancelled || !canvasRef.current) return;
        const unit = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / unit.width });
        const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
        const pixelViewport = page.getViewport({ scale: width / unit.width * ratio });
        const canvas = canvasRef.current;
        canvas.width = Math.round(pixelViewport.width);
        canvas.height = Math.round(pixelViewport.height);
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;
        setAspect(viewport.height / Math.max(1, viewport.width));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable.");
        task = page.render({ canvas, canvasContext: context, viewport: pixelViewport });
        await task.promise;
        if (!cancelled) setError(false);
      } catch (caught) {
        if (!cancelled && !(caught instanceof Error && caught.name === "RenderingCancelledException")) setError(true);
      }
    }
    void render();
    return () => { cancelled = true; task?.cancel(); if (canvasRef.current) { canvasRef.current.width = 0; canvasRef.current.height = 0; } };
  }, [active, number, pdf, width]);

  const height = Math.round(width * aspect);
  return <section id={`pdf-page-${number}`} data-reader-page={number} className="pdf-page" style={{ minHeight: height }} aria-label={`PDF page ${number}`}>
    {active ? <canvas ref={canvasRef} /> : <div className="page-placeholder" style={{ height }} />}
    {error && <div className="page-error">Page {number} could not be rendered. Scroll away and back to retry.</div>}
    <span className="page-label">{number}</span>
  </section>;
}

export default memo(PageSurface);
