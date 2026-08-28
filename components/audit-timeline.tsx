// Phase 5.2 — the audit timeline (presentational, server-renderable).
// Rows are the mockup vocabulary; `actions` is the header's right side
// (Replay this audit / Export as markdown).

import type { AuditRow } from "../lib/audit-rows";

export function AuditTimeline({
  title,
  rows,
  footer,
  actions,
}: {
  title?: string;
  rows: AuditRow[];
  footer: string;
  actions: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="audit-timeline">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-xl font-semibold">{title ? `Audit — ${title}` : "Audit"}</h1>
        <div className="flex flex-col items-end gap-2">{actions}</div>
      </div>
      <ol className="mt-4 rounded border border-[var(--border)] bg-[var(--panel)] p-3 font-mono text-sm leading-6">
        {rows.length === 0 && (
          <li className="text-[var(--muted)]">No audit rows yet.</li>
        )}
        {rows.map((r, i) => (
          <li key={i} className="flex gap-3" data-testid="audit-row" data-icon={r.icon}>
            <span className="text-[var(--muted)]">{r.ts}</span>
            <span className="w-4 text-center">{r.icon}</span>
            <span>{r.message}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-[var(--muted)]" data-testid="audit-footer">
        {footer}
      </p>
    </div>
  );
}
