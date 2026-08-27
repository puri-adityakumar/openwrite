// Phase 3.1 — Summary tab.
//
// Renders the agent's structured summary (title, abstract, TL;DR, claim
// + evidence counts). The shape matches the seed_audits JSON, so the
// same component renders for the seed path (Phase 1.3) and the live
// path (Phase 2+). The data is passed in by the parent (Cockpit) —
// this is a presentational component.

export type SummaryData = {
  title: string;
  abstract: string;
  tldr: string;
  claims_count: number;
  evidence_count: number;
};

export function Summary({ data }: { data: SummaryData }) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-4" data-testid="summary-tab">
      <h3 className="text-lg font-semibold">{data.title}</h3>
      <p className="mt-2 text-sm text-[var(--muted)] leading-6">{data.abstract}</p>
      <div className="mt-3 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm">
        <span className="text-[var(--muted)]">TL;DR — </span>
        {data.tldr}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]" data-testid="summary-counts">
        {data.claims_count} claims · {data.evidence_count} evidence
      </p>
    </div>
  );
}
