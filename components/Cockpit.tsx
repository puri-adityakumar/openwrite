// Phase 1.3 — Cockpit renderer for the seed path. Pure presentational
// component: takes the four surfaces from the seed_audits JSON and
// renders them. No data fetching, no client state — easier to test
// and to swap for a live renderer in Phase 2.
//
// NOTE: not imported by the live /paper/[slug] page (which uses
// CockpitClient via LiveCockpit). Kept for the seed-only render
// path and for parity tests.

export type SeedPill = { id: string; label: string; state: string };
export type SeedPage = { page: number; density: number };
export type SeedSummary = {
  title: string;
  abstract: string;
  tldr: string;
  claims_count: number;
  evidence_count: number;
};
export type SeedEvents = {
  trail: { pills: SeedPill[] };
  coverage: { pages: SeedPage[] };
  summary: SeedSummary;
  pulse: string[];
};

import { Pill } from "./Pill";

function pillTone(state: string): "good" | "warn" | "bad" | "idle" {
  if (state === "done") return "good";
  if (state === "running") return "warn";
  if (state === "error") return "bad";
  return "idle";
}

function densityGlyph(d: number): string {
  if (d < 0.25) return "░";
  if (d < 0.5) return "▒";
  if (d < 0.75) return "▓";
  return "█";
}

export function Cockpit({
  slug,
  title,
  status,
  events,
}: {
  slug: string;
  title: string;
  status: string;
  events: SeedEvents;
}) {
  return (
    <div className="page-wide py-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <a href="/dashboard" className="text-xs text-[var(--color-muted-foreground)] no-underline hover:underline">
            ← Dashboard
          </a>
          <h1 className="mt-2 text-2xl">{title || slug}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Pill tone="idle" title="Seed run — not live">Halted</Pill>
          <Pill tone="good">Cap: $0.012</Pill>
        </div>
      </div>
      <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
        Status: {status}
      </p>

      <section className="mt-8">
        <span className="rcp-eyebrow">Trail</span>
        <ol className="mt-3 flex flex-wrap gap-2" data-testid="trail-pills">
          {events.trail.pills.map((p) => (
            <li key={p.id} data-state={p.state}>
              <Pill tone={pillTone(p.state)}>{p.label}</Pill>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8">
        <span className="rcp-eyebrow">Coverage</span>
        <div className="mt-3 font-mono text-2xl tracking-widest text-[var(--color-foreground)]" data-testid="coverage-grid">
          {events.coverage.pages.map((c) => (
            <span key={c.page} title={`Page ${c.page}: ${c.density.toFixed(2)}`}>
              {densityGlyph(c.density)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          ░ sparse · ▒ light · ▓ medium · █ dense
        </p>
      </section>

      <section className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card">
          <span className="rcp-eyebrow">Summary</span>
          <h3 className="mt-3 text-lg">{events.summary.title}</h3>
          <p className="mt-3 text-sm leading-7">
            {events.summary.abstract}
          </p>
          <div className="mt-4 rounded border border-[var(--color-border)] bg-[var(--color-secondary)] p-3 text-sm">
            <span className="rcp-eyebrow" style={{ marginRight: "0.5rem" }}>TL;DR</span>
            {events.summary.tldr}
          </div>
          <p className="mt-4 text-xs text-[var(--color-muted-foreground)]">
            {events.summary.claims_count} claims · {events.summary.evidence_count} evidence
          </p>
        </div>
        <div className="card">
          <span className="rcp-eyebrow">Tabs</span>
          <ul className="mt-3 space-y-1 text-sm">
            <li className="font-medium text-[var(--color-foreground)]">Summary</li>
            <li className="text-[var(--color-muted-foreground)]">Claims</li>
            <li className="text-[var(--color-muted-foreground)]">Authors</li>
            <li className="text-[var(--color-muted-foreground)]">Audit</li>
          </ul>
        </div>
      </section>

      <section className="mt-8">
        <span className="rcp-eyebrow">Pulse</span>
        <pre
          className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-secondary)] p-3 text-xs font-mono leading-5 overflow-x-auto"
          data-testid="pulse"
        >
          {events.pulse.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </pre>
      </section>
    </div>
  );
}
