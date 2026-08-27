"use client";

// Phase 3 — Cockpit client wrapper.
//
// Owns: tab state, selected claim (for the Reader), Ask composer state,
// and the heartbeat clock. Renders the four surfaces (Trail, Coverage,
// Status row, Pulse) + the right-column Tabs + the Reader + the Ask
// composer.
//
// Used by both the seed path (Phase 1.3) and the live path (Phase 2);
// the parent passes the surfaces as props and a stream URL for the
// SSE store.

import { useEffect, useState } from "react";
import { Pulse } from "./pulse";
import { Tabs, type TabId } from "./tabs";
import { Summary } from "./tabs/summary";
import { Authors } from "./tabs/authors";
import { Claims } from "./tabs/claims";
import { Reader } from "./reader";
import { Ask } from "./ask";
import type { Claim } from "../lib/claims";
import type { LiveState, TrailPill } from "../lib/event-reducer";

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
  if (state.status === "queued") return "Queued — waiting for first turn…";
  if (state.status === "running") return `Auditing — ${state.pulse.length} events streamed.`;
  if (state.status === "paused") {
    const gates = state.gates.length;
    return `Paused on ${gates} approval gate${gates === 1 ? "" : "s"}.`;
  }
  if (state.status === "error") return "Turn errored — see Pulse for detail.";
  return `Done — ${state.pulse.length} events.`;
}

export type SummaryData = {
  title: string;
  abstract: string;
  tldr: string;
  claims_count: number;
  evidence_count: number;
};

export type CockpitClientProps = {
  slug: string;
  title: string;
  paperId: string;
  pills: TrailPill[];
  coverage: Array<{ page: number; density: number }>;
  liveState: LiveState;
  summary: SummaryData;
  pdfUrl: string | null;
  heartbeatEnabled?: boolean;
};

export function CockpitClient({
  slug,
  title,
  paperId,
  pills,
  coverage,
  liveState,
  summary,
  pdfUrl,
  heartbeatEnabled = true,
}: CockpitClientProps) {
  const [tab, setTab] = useState<TabId>("summary");
  const [openClaim, setOpenClaim] = useState<Claim | null>(null);
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [lastHeartbeat, setLastHeartbeat] = useState<string | null>(null);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!heartbeatEnabled) return;
    const fmt = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    };
    setLastHeartbeat(fmt());
    const id = setInterval(() => setLastHeartbeat(fmt()), 15_000);
    return () => clearInterval(id);
  }, [heartbeatEnabled]);

  return (
    <div className="max-w-6xl mx-auto p-6" data-testid="cockpit">
      <div className="flex items-center justify-between">
        <div>
          <a href="/dashboard" className="text-sm text-[var(--muted)]">◀ Dashboard</a>
          <h1 className="text-xl font-semibold mt-1">{slug}</h1>
          <p className="text-xs text-[var(--muted)]">{title}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <span className="rounded border border-[var(--border)] px-2 py-1" data-testid="halt-btn">⏸ Halt</span>
          <span className="rounded border border-[var(--border)] px-2 py-1" data-testid="cap-chip">
            Cap: {liveState.metrics.costDisplay}
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm" data-testid="status-row">
        <span className="text-[var(--muted)]">Status: </span>
        <span data-testid="status-verb">{statusVerb(liveState)}</span>
        <span className="ml-2 text-[var(--muted)]">
          tokens {liveState.metrics.totalTokens.toLocaleString()}
        </span>
        {liveState.sandboxId && (
          <span className="ml-2 text-[var(--muted)]" data-testid="sandbox-id">
            sandbox {liveState.sandboxId}
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
          {coverage.length === 0 ? (
            <span className="text-[var(--muted)] text-sm">— no coverage yet —</span>
          ) : (
            coverage.map((c) => (
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

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Tabs
            slug={slug}
            active={tab}
            onChange={setTab}
            panels={{
              summary: <Summary data={summary} />,
              claims: <ClaimsLoader paperId={paperId} onOpenClaim={setOpenClaim} />,
              authors: <Authors paperId={paperId} />,
              audit: <div className="text-sm text-[var(--muted)]">See <a className="text-[var(--accent)] underline" href={`/paper/${slug}/audit`}>audit timeline</a>.</div>,
            }}
          />
        </div>
        <div className="rounded border border-[var(--border)] bg-[var(--panel)] p-4">
          <h2 className="text-sm font-medium text-[var(--muted)]">Pulse</h2>
          <Pulse state={liveState} lastHeartbeat={lastHeartbeat} />
        </div>
      </section>

      <Ask
        paperId={paperId}
        onCite={(claimId) => {
          // We don't have the Claim object on hand here; the Reader can
          // be opened from a Claims row click instead. The Ask answer
          // citations are still useful as a hint that the answer is
          // grounded — they scroll to the Reader when present.
          if (openClaim?.id === claimId) return;
          // Lazy: don't fetch the claim here; the user can open the
          // Claims tab and click the row. Future: surface a list of
          // suggested opens.
        }}
      />

      {openClaim && (
        <Reader
          claim={openClaim}
          pdfUrl={pdfUrl}
          onClose={() => setOpenClaim(null)}
          viewportWidth={viewportWidth}
        />
      )}
    </div>
  );
}

// Lazy-loads claims for the Claims tab. Kept inline so the cockpit
// can stay a single client component.
function ClaimsLoader({
  paperId,
  onOpenClaim,
}: {
  paperId: string;
  onOpenClaim: (c: Claim) => void;
}) {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/papers/${paperId}/claims`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { ok: boolean; claims: Claim[] };
      })
      .then((d) => { if (!cancelled) setClaims(d.claims ?? []); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [paperId]);
  if (error) return <div className="text-sm text-[var(--bad)]">Claims error: {error}</div>;
  if (claims === null) return <div className="text-sm text-[var(--muted)]">Loading claims…</div>;
  return <Claims claims={claims} onOpenClaim={onOpenClaim} />;
}
