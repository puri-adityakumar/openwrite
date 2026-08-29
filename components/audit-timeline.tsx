// Phase 5.2 — the audit timeline (presentational, server-renderable).

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
    <div className="page py-10" data-testid="audit-timeline">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="rcp-eyebrow">Audit</span>
          <h1 className="mt-3 text-2xl md:text-3xl">{title ?? "Audit"}</h1>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      <ol className="mt-6 card font-mono text-sm leading-7" style={{ padding: "0.75rem 1rem" }}>
        {rows.length === 0 && (
          <li className="text-[var(--color-muted-foreground)]">No audit rows yet.</li>
        )}
        {rows.map((r, i) => (
          <li key={i} className="flex gap-3" data-testid="audit-row" data-icon={r.icon}>
            <span className="text-[var(--color-muted-foreground)] shrink-0">{r.ts}</span>
            <span className="w-4 text-center shrink-0">{r.icon}</span>
            <span className="text-[var(--color-foreground)]">{r.message}</span>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-[var(--color-muted-foreground)]" data-testid="audit-footer">
        {footer}
      </p>
    </div>
  );
}
