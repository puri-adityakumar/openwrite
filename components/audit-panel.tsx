"use client";

import { useEffect, useState } from "react";

// In-chat Audit panel — a collapsible timeline of everything the agent
// did, fed by /api/papers/[id]/audit (same rows as the full /audit page).
// Collapsed by default so the run log stays the star; expanded it reads
// as a compact ledger.

type AuditRow = { ts: string; icon: string; message: string };

export function AuditPanel({ paperId }: { paperId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch lazily on first expand — the audit can be long and the pane
  // shouldn't pay for it on every cockpit paint.
  useEffect(() => {
    if (!open || rows !== null || error !== null) return;
    let cancelled = false;
    fetch(`/api/papers/${paperId}/audit`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { ok: boolean; rows: AuditRow[] };
      })
      .then((d) => { if (!cancelled) setRows(d.rows ?? []); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [open, rows, error, paperId]);

  const count = rows?.length ?? null;

  return (
    <section
      className="audit-panel"
      data-testid="audit-panel"
      data-open={open ? "true" : "false"}
    >
      <button
        type="button"
        className="audit-panel-head"
        aria-expanded={open}
        aria-controls="audit-panel-body"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="audit-panel-title">Audit trail</span>
        {count !== null && <span className="audit-panel-count">{count}</span>}
        <span aria-hidden="true" className="audit-panel-caret">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div id="audit-panel-body" className="audit-panel-body">
          {error && (
            <p className="audit-panel-error" role="alert">Audit error: {error}</p>
          )}
          {!error && rows === null && <p className="audit-panel-note">Loading…</p>}
          {!error && rows !== null && rows.length === 0 && (
            <p className="audit-panel-note">Nothing yet — steps land here as the agent works.</p>
          )}
          {rows?.map((r, i) => (
            <div key={i} className="pulse-row" data-testid="audit-panel-row">
              <span className="pulse-time">{r.ts}</span>
              <span className="audit-panel-icon" aria-hidden="true">{r.icon}</span>
              <span className="pulse-text">{r.message}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
