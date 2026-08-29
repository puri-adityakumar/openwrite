"use client";

import { useEffect, useRef, useState } from "react";

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
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Inert the rest of the page so background controls are not
    // tab-reachable and not announced while the dialog is open.
    // We grab everything that is not the dialog shell.
    const root = document.body;
    const dialog = modalRef.current;
    const siblings = Array.from(root.children).filter((el) => el !== dialog) as HTMLElement[];
    const prevInert = siblings.map((el) => el.hasAttribute("inert"));
    siblings.forEach((el) => el.setAttribute("inert", ""));
    // Move focus into the dialog.
    closeRef.current?.focus();
    // Escape closes; Tab is trapped to the dialog by the browser
    // when we mark the rest of the tree inert.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      siblings.forEach((el, i) => {
        if (!prevInert[i]) el.removeAttribute("inert");
      });
      openerRef.current?.focus();
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    openerRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        ref={openerRef}
        data-testid="tour-open"
        onClick={() => { setOpen(true); setIndex(0); }}
        title="How Openwrite works"
        className="btn btn-secondary"
        style={{
          position: "fixed", bottom: "1.25rem", right: "1.25rem", zIndex: 40,
          borderRadius: "var(--radius-full)", padding: "0.5rem 1rem", fontSize: "0.875rem",
          background: "var(--color-secondary)", borderColor: "var(--color-border)",
        }}
      >
        ⓘ How it works
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(11,13,18,0.72)" }}
          data-testid="tour-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-title"
          ref={modalRef}
        >
          <div className="card w-full" style={{ maxWidth: "42rem" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm" id="tour-title">How Openwrite works</h2>
              <button
                type="button"
                ref={closeRef}
                data-testid="tour-close"
                onClick={close}
                className="btn-tiny"
              >
                Close
              </button>
            </div>

            <ol className="mt-4 space-y-4">
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
                    className="w-full rounded border border-[var(--color-border)]"
                  />
                  <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">{s.caption}</p>
                </li>
              ))}
            </ol>

            <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
              <button
                type="button"
                data-testid="tour-prev"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="btn btn-secondary"
                style={{ minHeight: 44, padding: "0.625rem 1rem" }}
              >
                ← Prev
              </button>
              <span className="text-xs text-[var(--color-muted-foreground)]" data-testid="tour-counter">
                {index + 1} / {SLIDES.length}
              </span>
              <button
                type="button"
                data-testid="tour-next"
                onClick={() => setIndex((i) => Math.min(SLIDES.length - 1, i + 1))}
                disabled={index === SLIDES.length - 1}
                className="btn btn-secondary"
                style={{ minHeight: 44, padding: "0.625rem 1rem" }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
