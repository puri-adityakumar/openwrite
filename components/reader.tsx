"use client";

import { useEffect, useRef, useState } from "react";
import { drawerClassForViewport } from "../lib/reader";
import type { Claim } from "../lib/claims";

type PdfModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfModule> | null = null;
function loadPdfjs(): Promise<PdfModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      const workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export function Reader({
  claim,
  pdfUrl,
  onClose,
  viewportWidth,
}: {
  claim: Claim | null;
  pdfUrl: string | null;
  onClose: () => void;
  viewportWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const className = drawerClassForViewport(viewportWidth);

  useEffect(() => {
    if (!claim || !pdfUrl) return;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const loadingTask = pdfjs.getDocument({ url: pdfUrl });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        const pageNum = claim.page ?? 1;
        const page = await doc.getPage(pageNum);
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const viewport = page.getViewport({ scale: 1.4 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        setPdfLoading(false);
      } catch (e) {
        if (!cancelled) {
          setPdfError((e as Error).message);
          setPdfLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [claim, pdfUrl]);

  if (!claim) return null;

  return (
    <aside
      data-testid="reader-drawer"
      data-class={className}
      className={
        className === "reader-split"
          ? "fixed top-0 right-0 h-full w-2/5 border-l border-[var(--color-border)] bg-[var(--color-background)] p-4 overflow-y-auto z-40"
          : "mt-6 card"
      }
    >
      <div className="flex items-center justify-between">
        <span className="rcp-eyebrow">Reader</span>
        <button
          type="button"
          onClick={onClose}
          data-testid="reader-close"
          className="btn-tiny"
        >
          Close
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div data-testid="reader-pdf" className="rounded border border-[var(--color-border)] bg-white order-2 md:order-1">
          {pdfLoading && <div className="p-4 text-sm text-[var(--color-muted-foreground)]">Loading page {claim.page ?? "—"}.</div>}
          {pdfError && <div className="p-4 text-sm text-[var(--color-destructive)]" role="alert">PDF error: {pdfError}</div>}
          <canvas ref={canvasRef} className="block max-w-full" data-testid="reader-canvas" />
        </div>
        <div data-testid="reader-claim" className="order-1 md:order-2">
          <h4 className="text-sm">Claim</h4>
          <p className="mt-1 text-sm text-[var(--color-foreground)]">{claim.text}</p>
          {claim.evidence && (
            <>
              <h4 className="mt-4 text-sm">Evidence</h4>
              <blockquote className="mt-1 border-l-2 border-[var(--color-border)] pl-3 text-sm text-[var(--color-muted-foreground)]">
                {claim.evidence}
              </blockquote>
            </>
          )}
          <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
            Page {claim.page ?? "—"} · Confidence{" "}
            {claim.confidence === null ? "—" : `${Math.round(claim.confidence * 100)}%`}
          </p>
        </div>
      </div>
    </aside>
  );
}
