"use client";

// Phase 6.3 — the Tour modal. A floating "ⓘ How it works" button
// (fixed bottom-right) opens a 7-slide walkthrough — one screenshot
// per surface, each with a one-line caption. Prev/Next + Escape +
// close. Static assets only: the slides are pre-rendered screenshots
// in /public/tour, so the tour works offline.

import { useEffect, useState } from "react";

const SLIDES: Array<{ src: string; caption: string }> = [
  { src: "/tour/1-landing.png", caption: "Landing — sign in with the printed demo creds, one click." },
  { src: "/tour/2-dashboard.png", caption: "Dashboard — your runs; first paint is a populated demo, not an empty state." },
  { src: "/tour/3-new-paper.png", caption: "Drop a paper (arXiv URL or PDF) and pick a verb: Learn, Deep-read, or Review." },
  { src: "/tour/4-cockpit.png", caption: "The cockpit — Trail, Coverage grid, Pulse, and the live run, verb-first." },
  { src: "/tour/5-verify-gate.png", caption: "The Verify gate — the full G1 spec; type the repo owner and hold 3s before any code runs." },
  { src: "/tour/6-audit.png", caption: "The audit — every event, replayable on a fresh sandbox." },
  { src: "/tour/7-export.png", caption: "The export — the review as markdown, locked until the Publish gate allows it." },
];

export function Tour() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        data-testid="tour-open"
        onClick={() => { setOpen(true); setIndex(0); }}
        className="fixed bottom-5 right-5 z-40 rounded-full border border-[var(--border)] bg-[var(--panel)] px-4 py-2 text-sm shadow-md hover:bg-[var(--panel-2)]"
        title="How Recap works"
      >
        ⓘ How it works
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          data-testid="tour-modal"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-lg border border-[var(--border)] bg-[var(--bg)] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">How Recap works</h2>
              <button
                type="button"
                data-testid="tour-close"
                onClick={() => setOpen(false)}
                className="rounded border border-[var(--border)] px-2 py-0.5 text-sm text-[var(--muted)] hover:bg-[var(--panel-2)]"
              >
                ✕ Close
              </button>
            </div>

            <ol className="mt-3 space-y-4">
              {SLIDES.map((s, i) => (
                <li
                  key={s.src}
                  data-testid="tour-slide"
                  className={i === index ? "block" : "hidden"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.src}
                    alt={s.caption}
                    className="w-full rounded border border-[var(--border)]"
                  />
                  <p className="mt-2 text-sm text-[var(--muted)]">{s.caption}</p>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
              <button
                type="button"
                data-testid="tour-prev"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="rounded border border-[var(--border)] px-3 py-1 text-sm disabled:opacity-40"
              >
                ◀ Prev
              </button>
              <span className="text-xs text-[var(--muted)]" data-testid="tour-counter">
                {index + 1} / {SLIDES.length}
              </span>
              <button
                type="button"
                data-testid="tour-next"
                onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
                disabled={index === SLIDES.length - 1}
                className="rounded border border-[var(--border)] px-3 py-1 text-sm disabled:opacity-40"
              >
                Next ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
