// Phase 3.1 — Summary tab.

export type SummaryData = {
  title: string;
  abstract: string;
  tldr: string;
  claims_count: number;
  evidence_count: number;
};

export function Summary({ data }: { data: SummaryData }) {
  return (
    <div data-testid="summary-tab" className="card">
      <h3 className="text-lg">{data.title}</h3>
      <p className="mt-3 text-sm leading-7">{data.abstract}</p>
      <div className="mt-4 rounded border border-[var(--color-border)] bg-[var(--color-secondary)] p-3 text-sm">
        <span className="rcp-eyebrow" style={{ marginRight: "0.5rem" }}>TL;DR</span>
        {data.tldr}
      </div>
      <p className="mt-4 text-xs text-[var(--color-muted-foreground)]" data-testid="summary-counts">
        {data.claims_count} claims · {data.evidence_count} evidence
      </p>
    </div>
  );
}
