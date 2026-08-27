"use client";

// Phase 3.2 — Reader drawer.
//
// Renders a PDF page side-by-side with the cited claim + evidence +
// confidence. PDF.js loads the page on demand; the source PDF URL
// is /api/files/:paperId/pdf (or a data: URL for the seed fixture).
//
// Per Phase 3.2#2: 40/60 split on ≥1440 px; replaces the right
// column below 1440 px. The class is computed by lib/reader's
// drawerClassForViewport and applied here.

import { useEffect, useRef, useState } from "react";
import { drawerClassForViewport } from "../lib/reader";
import type { Claim } from "../lib/claims";

type PdfModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfModule> | null = null;
function loadPdfjs(): Promise<PdfModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist");
      // The worker is shipped in node_modules/pdfjs-dist/build. We point
      // at the .mjs file via a CDN-style URL (works because Next.js
      // serves /node_modules as static during dev). In production, copy
      // the worker to /public and reference it from there.
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
          ? "fixed top-0 right-0 h-full w-2/5 border-l border-[var(--border)] bg-[var(--bg)] p-4 overflow-y-auto z-40"
          : "mt-6 rounded border border-[var(--border)] bg-[var(--panel)] p-4"
      }
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Reader</h3>
        <button
          type="button"
          onClick={onClose}
          data-testid="reader-close"
          className="rounded border border-[var(--border)] px-2 py-0.5 text-xs"
        >
          Close
        </button>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div data-testid="reader-pdf" className="rounded border border-[var(--border)] bg-white">
          {pdfLoading && <div className="p-4 text-sm text-[var(--muted)]">Loading page {claim.page ?? "—"}…</div>}
          {pdfError && <div className="p-4 text-sm text-[var(--bad)]">PDF error: {pdfError}</div>}
          <canvas ref={canvasRef} className="block max-w-full" data-testid="reader-canvas" />
        </div>
        <div data-testid="reader-claim">
          <p className="text-sm font-semibold">Claim</p>
          <p className="mt-1 text-sm">{claim.text}</p>
          {claim.evidence && (
            <>
              <p className="mt-3 text-sm font-semibold">Evidence</p>
              <blockquote className="mt-1 border-l-2 border-[var(--border)] pl-3 text-sm text-[var(--muted)]">
                {claim.evidence}
              </blockquote>
            </>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">
            Page {claim.page ?? "—"} · Confidence{" "}
            {claim.confidence === null ? "—" : `${Math.round(claim.confidence * 100)}%`}
          </p>
        </div>
      </div>
    </aside>
  );
}
