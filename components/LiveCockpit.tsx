"use client";

// Phase 2.3 — live Cockpit renderer.
//
// Wires the four left-column surfaces (Trail, Coverage, Status row,
// Pulse) to the SSE store. Pill states are derived from the reducer
// state — single source of truth per Phase 2.3#1. Coverage fills from
// real tool results (Phase 2.3#2). Status row is verb-first with the
// cost "—" rule (Phase 2.3#3).
//
// The mockup at docs/ui-mockups.md is binding for layout, hierarchy,
// and labeled elements. Spacing/copy may be refined.

import { useCockpitState } from "../lib/sse-store";
import type { LiveState } from "../lib/event-reducer";

function pillTone(state: string): string {
  if (state === "done") return "bg-[var(--good)] text-black";
  if (state === "running") return "bg-[var(--warn)] text-black animate-pulse";
  if (state === "error") return "bg-[var(--bad)] text-white";
  return "bg-[var(--panel-2)] text-[var(--muted)]";
}

function densityGlyph(d: number): string {
  if (d < 0.25) return "░";
  if (d < 0.5) return "▒";
  if (d < 0.75) return "▓";
  return "█";
}

function statusVerb(state: LiveState): string {
  // Verb-first status row per docs/ui-mockups.md.
  if (state.status === "queued") return "Queued — waiting for first turn…";
  if (state.status === "running") {
    const done = state.pulse.length;
    return `Auditing — ${done} events streamed.`;
  }
  if (state.status === "paused") {
    const gates = state.gates.length;
    return `Paused on ${gates} approval gate${gates === 1 ? "" : "s"}.`;
  }
  if (state.status === "error") return "Turn errored — see Pulse for detail.";
  return `Done — ${state.pulse.length} events.`;
}

export function LiveCockpit({ slug, title, streamUrl }: {
  slug: string;
  title: string;
  streamUrl: string;
}) {
  const { state, pills, status } = useCockpitState(streamUrl);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <a href="/dashboard" className="text-sm text-[var(--muted)]">◀ Dashboard</a>
          <h1 className="text-xl font-semibold mt-1">{slug}</h1>
          <p className="text-xs text-[var(--muted)]">{title}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="rounded border border-[var(--border)] px-2 py-1" data-testid="halt-btn">⏸ Halt</span>
          <span className="rounded border border-[var(--border)] px-2 py-1" data-testid="cap-chip">
            Cap: {state.metrics.costDisplay}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm" data-testid="status-row">
        <span className="text-[var(--muted)]">Status: </span>
        <span data-testid="status-verb">{statusVerb(state)}</span>
        <span className="ml-2 text-[var(--muted)]">
          tokens {state.metrics.totalTokens.toLocaleString()}
        </span>
        {state.sandboxId && (
          <span className="ml-2 text-[var(--muted)]" data-testid="sandbox-id">
            sandbox {state.sandboxId}
          </span>
        )}
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-[var(--muted)]">Trail</h2>
        <ol className="mt-2 flex flex-wrap gap-2" data-testid="trail-pills">
          {pills.map((p) => (
            <li
              key={p.id}
              className={"rounded-full px-3 py-1 text-sm " + pillTone(p.state)}
              data-state={p.state}
              data-pill={p.id}
            >
              {p.label}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-[var(--muted)]">Coverage</h2>
        <div className="mt-2 font-mono text-2xl tracking-widest" data-testid="coverage-grid">
          {state.coverage.length === 0 ? (
            <span className="text-[var(--muted)] text-sm">— no coverage yet —</span>
          ) : (
            state.coverage.map((c) => (
              <span key={c.page} title={`Page ${c.page}: ${c.density.toFixed(2)}`}>
                {densityGlyph(c.density)}
              </span>
            ))
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          ░ sparse · ▒ light · ▓ medium · █ dense (denser = more cited)
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-[var(--muted)]">Pulse</h2>
        <pre
          className="mt-2 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs font-mono leading-5 overflow-x-auto"
          data-testid="pulse"
        >
          {state.pulse.length === 0 ? (
            <div className="text-[var(--muted)]">— waiting for events —</div>
          ) : (
            state.pulse.map((line, i) => <div key={i}>{line}</div>)
          )}
        </pre>
      </section>

      <p className="mt-6 text-xs text-[var(--muted)]">
        Phase 2 live render · {status}
      </p>
    </div>
  );
}
