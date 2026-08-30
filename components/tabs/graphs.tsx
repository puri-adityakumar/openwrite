"use client";

// Workspace redesign — Graphs tab: a 2×2 grid of small analytics tiles
// built from data the cockpit already has (or can cheaply fetch):
//   (a) claim score distribution — histogram over claim confidence; if
//       the run produced no scores, degrade to a claims-by-evidence bar.
//   (b) page coverage heat strip — the cov-tiles markup moved here from
//       the old main column (same coverage-grid testid + tiles).
//   (c) tokens/cost — big number from liveState.metrics, with a usage
//       bar when the paper carries a cap.
//   (d) evidence breakdown — claims with vs without quoted evidence;
//       falls back to run facts (sandbox id) when claims are absent.
// Every tile has an empty state; nothing renders a fake zero chart.

import { useEffect, useState } from "react";
import type { Claim } from "../../lib/claims";
import type { Metrics } from "../../lib/event-reducer";

export type GraphsCoverage = Array<{ page: number; density: number }>;

const SCORE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "<50%", min: 0, max: 0.5 },
  { label: "50–70%", min: 0.5, max: 0.7 },
  { label: "70–90%", min: 0.7, max: 0.9 },
  { label: "≥90%", min: 0.9, max: 1.01 },
];

export function Graphs({
  paperId,
  coverage,
  metrics,
  capUsd,
  capTokens,
  sandboxId,
}: {
  paperId: string;
  coverage: GraphsCoverage;
  metrics: Metrics;
  capUsd: number | null;
  capTokens: number | null;
  sandboxId: string | null;
}) {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/papers/${paperId}/claims`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { ok: boolean; claims: Claim[] };
      })
      .then((d) => { if (!cancelled) setClaims(d.claims ?? []); })
      .catch(() => { if (!cancelled) setClaims([]); });
    return () => { cancelled = true; };
  }, [paperId]);

  return (
    <div className="graphs-grid">
      {/* (a) Claim score distribution (or evidence fallback) */}
      <GraphTile title="Claim scores" caption="How confident the agent was, per claim">
        <ScoreHistogram claims={claims ?? []} loading={claims === null} />
      </GraphTile>

      {/* (b) Page coverage heat strip (moved from the old main column).
              The grid div stays mounted even when empty — same contract
              as the pre-workspace coverage section. */}
      <GraphTile title="Page coverage" caption={coverageCaption(coverage)}>
        <div className="cov-tiles" data-testid="coverage-grid">
          {coverage.map((c) => (
            <span
              key={c.page}
              className="cov-tile"
              style={{ ["--cov" as never]: `${Math.round(Math.min(1, Math.max(0, c.density)) * 100)}%` }}
              title={`Page ${c.page} — ${Math.round(c.density * 100)}% of its claims are cited`}
            />
          ))}
        </div>
        {coverage.length === 0 && (
          <p className="graph-empty">Pages appear here as the agent reads them.</p>
        )}
      </GraphTile>

      {/* (c) Tokens / cost */}
      <GraphTile title="Run usage" caption={metrics.costDisplay === "—" ? "Tokens billed to this run" : `Estimated cost ${metrics.costDisplay}`}>
        <div className="graph-bignum" data-testid="graphs-tokens">
          {metrics.totalTokens.toLocaleString()}
          <span className="graph-bignum-unit">tokens</span>
        </div>
        <UsageBar
          usedTokens={metrics.totalTokens}
          capTokens={capTokens}
          capUsd={capUsd}
        />
      </GraphTile>

      {/* (d) Evidence breakdown, or run facts when claims are absent */}
      <GraphTile title="Evidence" caption="Claims backed by quoted source text">
        <EvidenceBreakdown claims={claims} sandboxId={sandboxId} />
      </GraphTile>
    </div>
  );
}

/* ---- Tile chrome ------------------------------------------------- */

function GraphTile({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="graph-tile">
      <span className="graph-title">{title}</span>
      <span className="graph-caption">{caption}</span>
      <div className="graph-body">{children}</div>
    </div>
  );
}

function coverageCaption(coverage: GraphsCoverage): string {
  if (coverage.length === 0) return "Pages read, by claim density";
  return `${coverage.length} ${coverage.length === 1 ? "page" : "pages"} read · darker = more claims cited there`;
}

/* ---- (a) Score histogram (with evidence-count degradation) ------- */

function ScoreHistogram({
  claims,
  loading,
}: {
  claims: Claim[];
  loading: boolean;
}) {
  if (loading) return <p className="graph-empty">Loading claims…</p>;
  const scored = claims.filter((c) => typeof c.confidence === "number");
  if (claims.length === 0) {
    return <p className="graph-empty">No claims extracted yet — the histogram fills in after the extract step.</p>;
  }
  if (scored.length === 0) {
    // Degrade: no scores on this run — show claims by evidence instead.
    const withEvidence = claims.filter((c) => c.evidence).length;
    return (
      <div className="graph-bar-row" aria-label="Claims by evidence">
        <BarRow label="With evidence" value={withEvidence} total={claims.length} tone="good" />
        <BarRow label="Without" value={claims.length - withEvidence} total={claims.length} tone="idle" />
        <p className="graph-empty">No scores on this run — bars show evidence instead.</p>
      </div>
    );
  }
  const counts = SCORE_BUCKETS.map(
    (b) => scored.filter((c) => (c.confidence as number) >= b.min && (c.confidence as number) < b.max).length,
  );
  const max = Math.max(...counts, 1);
  return (
    <div className="graph-hist" role="img" aria-label="Claim score distribution">
      {SCORE_BUCKETS.map((b, i) => (
        <div key={b.label} className="graph-hist-col">
          <span
            className={`graph-hist-bar${i === SCORE_BUCKETS.length - 1 ? " is-top" : ""}`}
            style={{ height: `${Math.max(counts[i] / max, counts[i] > 0 ? 0.12 : 0.03) * 100}%` }}
            title={`${counts[i]} ${counts[i] === 1 ? "claim" : "claims"} at ${b.label}`}
          />
          <span className="graph-hist-count">{counts[i] || ""}</span>
          <span className="graph-hist-label">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- (c) Usage bar ----------------------------------------------- */

function UsageBar({
  usedTokens,
  capTokens,
  capUsd,
}: {
  usedTokens: number;
  capTokens: number | null;
  capUsd: number | null;
}) {
  // A bar only makes sense against a cap; without one the number is the fact.
  if (capTokens === null || capTokens <= 0) {
    return (
      <p className="graph-empty">
        {capUsd !== null ? `Cost cap $${capUsd.toFixed(2)} — token cap not set.` : "No cap set for this run."}
      </p>
    );
  }
  const pct = Math.min(100, Math.round((usedTokens / capTokens) * 100));
  return (
    <div className="graph-usage">
      <div
        className="graph-usage-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Token budget used"
      >
        <div className={`graph-usage-fill${pct >= 100 ? " is-over" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="graph-caption">Cap {capTokens.toLocaleString()} · {pct}%</span>
    </div>
  );
}

/* ---- (d) Evidence breakdown / run facts -------------------------- */

function EvidenceBreakdown({
  claims,
  sandboxId,
}: {
  claims: Claim[] | null;
  sandboxId: string | null;
}) {
  if (claims === null) return <p className="graph-empty">Loading claims…</p>;
  if (claims.length === 0) {
    return (
      <div className="graph-facts">
        {sandboxId ? (
          <div className="flex justify-between gap-2">
            <dt>Sandbox</dt>
            <dd data-testid="graphs-sandbox-id">{sandboxId}</dd>
          </div>
        ) : (
          <p className="graph-empty">Run facts appear here once the run starts a sandbox.</p>
        )}
      </div>
    );
  }
  const withEvidence = claims.filter((c) => c.evidence).length;
  const pages = new Set(claims.map((c) => c.page).filter((p): p is number => typeof p === "number"));
  return (
    <div className="graph-bar-row">
      <BarRow label="With evidence" value={withEvidence} total={claims.length} tone="good" />
      <BarRow label="Without" value={claims.length - withEvidence} total={claims.length} tone="idle" />
      <div className="graph-facts">
        <div className="flex justify-between gap-2">
          <dt>Pages cited</dt>
          <dd>{pages.size}</dd>
        </div>
        {sandboxId && (
          <div className="flex justify-between gap-2">
            <dt>Sandbox</dt>
            <dd data-testid="graphs-sandbox-id">{sandboxId}</dd>
          </div>
        )}
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "good" | "idle";
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="graph-bar">
      <span className="graph-bar-label">{label}</span>
      <span className="graph-bar-track">
        <span className={`graph-bar-fill is-${tone}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="graph-bar-value">{value}</span>
    </div>
  );
}
