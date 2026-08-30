// Phase 3.1 — Summary tab. Phase 2 redesign: the TL;DR leads in the
// receipt voice (the page's one serif moment), the abstract follows
// set for reading, counts close. No duplicate title — the header
// already says which paper this is.

export type SummaryData = {
  title: string;
  abstract: string;
  tldr: string;
  claims_count: number;
  evidence_count: number;
};

export function Summary({ data }: { data: SummaryData }) {
  return (
    <div data-testid="summary-tab">
      <span className="cockpit-label">In one line</span>
      <blockquote className="tldr mt-3">{data.tldr}</blockquote>
      <p className="paper-abstract">{data.abstract}</p>
      <p className="tldr-footer" data-testid="summary-counts">
        {data.claims_count} {data.claims_count === 1 ? "claim" : "claims"} ·{" "}
        {data.evidence_count} {data.evidence_count === 1 ? "piece of evidence" : "pieces of evidence"} — each
        one links to the page it came from.
      </p>
    </div>
  );
}
