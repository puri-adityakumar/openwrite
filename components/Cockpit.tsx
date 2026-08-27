// Phase 1.3 — Cockpit renderer for the seed path. Pure presentational
// component: takes the four surfaces from the seed_audits JSON and
// renders them. No data fetching, no client state — easier to test
// and to swap for a live renderer in Phase 2.

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

function pillTone(state: string): string {
  if (state === "done") return "bg-[var(--good)] text-black";
  if (state === "running") return "bg-[var(--warn)] text-black";
  if (state === "error") return "bg-[var(--bad)] text-white";
  return "bg-[var(--panel-2)] text-[var(--muted)]";
}

function densityGlyph(d: number): string {
  // 0..0.25 ░, 0.25..0.5 ▒, 0.5..0.75 ▓, 0.75..1 █
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
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <a href="/dashboard" className="text-sm text-[var(--muted)]">◀ Dashboard</a>
          <h1 className="text-xl font-semibold mt-1">{slug}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="rounded border border-[var(--border)] px-2 py-1">⏸ Halt</span>
          <span className="rounded border border-[var(--border)] px-2 py-1">Cap: $0.012</span>
        </div>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Status: {status}
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-[var(--muted)]">Trail</h2>
        <ol className="mt-2 flex flex-wrap gap-2" data-testid="trail-pills">
          {events.trail.pills.map((p) => (
            <li
              key={p.id}
              className={"rounded-full px-3 py-1 text-sm " + pillTone(p.state)}
              data-state={p.state}
            >
              {p.label}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-[var(--muted)]">Coverage</h2>
        <div className="mt-2 font-mono text-2xl tracking-widest" data-testid="coverage-grid">
          {events.coverage.pages.map((c) => (
            <span key={c.page} title={`Page ${c.page}: ${c.density.toFixed(2)}`}>
              {densityGlyph(c.density)}
            </span>
          ))}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          ░ sparse · ▒ light · ▓ medium · █ dense
        </p>
      </section>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="text-sm font-medium text-[var(--muted)]">Summary</h2>
          <h3 className="mt-2 text-lg font-semibold">{events.summary.title}</h3>
          <p className="mt-2 text-sm text-[var(--muted)] leading-6">
            {events.summary.abstract}
          </p>
          <div className="mt-3 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-sm">
            <span className="text-[var(--muted)]">TL;DR — </span>
            {events.summary.tldr}
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            {events.summary.claims_count} claims · {events.summary.evidence_count} evidence
          </p>
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="text-sm font-medium text-[var(--muted)]">Tabs</h2>
          <ul className="mt-2 space-y-1 text-sm">
            <li className="font-semibold text-[var(--accent)]">Summary</li>
            <li>Claims</li>
            <li>Authors</li>
            <li>Audit</li>
          </ul>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-[var(--muted)]">Pulse</h2>
        <pre className="mt-2 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs font-mono leading-5 overflow-x-auto" data-testid="pulse">
          {events.pulse.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </pre>
      </section>
    </div>
  );
}
