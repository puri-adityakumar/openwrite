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
import { VerifyCard } from "./gates/verify-card";
import { PublishCard } from "./gates/publish-card";
import { SaveCard } from "./gates/save-card";
import { HaltButton } from "./halt-button";
import { CapChip } from "./cap-chip";
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
  // Phase 5.1 — halt + cap state from the papers row.
  halted?: boolean;
  capUsd?: number | null;
  capTokens?: number | null;
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
  halted = false,
  capUsd = null,
  capTokens = null,
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
          <HaltButton paperId={paperId} status={liveState.status} halted={halted} />
          <CapChip
            capUsd={capUsd}
            capTokens={capTokens}
            totalTokens={liveState.metrics.totalTokens}
            costDisplay={liveState.metrics.costDisplay}
          />
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

      {liveState.status === "paused" && (
        <section className="mt-6" data-testid="gate-panel">
          <VerifyGatePanel
            paperId={paperId}
            slug={slug}
            title={title}
            onAllowed={() => {
              // The card posted allow; flip the cockpit back to running
              // by waiting for the resumed turn's first event. The
              // simplest UX is to reload the page so the SSE stream
              // reattaches and the paper status flips to "running".
              window.location.reload();
            }}
            onDenied={() => { window.location.reload(); }}
          />
        </section>
      )}

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
        onCite={async (claimId) => {
          // Qodo #2: clicking a citation in the answer must open the
          // Reader at the cited claim, completing the answer-to-Reader
          // loop. We fetch the claim (the CockpitClient owns the
          // reader state; Ask just emits the click).
          if (openClaim?.id === claimId) return;
          try {
            const r = await fetch(`/api/papers/${paperId}/claims`);
            if (!r.ok) return;
            const data = (await r.json()) as { ok: boolean; claims: Claim[] };
            const target = (data.claims ?? []).find((c) => c.id === claimId);
            if (target) {
              setOpenClaim(target);
              setTab("claims");
            }
          } catch {
            // best-effort: the user can still click the Claims row
          }
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

// Phase 4.2 — Verify gate panel. Fetches the paper's most-recent
// pending gate, composes the G1 props from the paper row + payload,
// and renders the Verify card. The card calls back to the approve
// route and triggers a reload on success so the live SSE stream
// reattaches to the resumed turn.
function VerifyGatePanel({
  paperId,
  slug,
  title,
  onAllowed,
  onDenied,
}: {
  paperId: string;
  slug: string;
  title: string;
  onAllowed: () => void;
  onDenied: () => void;
}) {
  const [gate, setGate] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/papers/${paperId}/gates`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { ok: boolean; gate: Record<string, unknown> | null };
      })
      .then((d) => { if (!cancelled) setGate(d.gate); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [paperId]);
  if (error) return <div data-testid="gate-error" className="text-sm text-[var(--bad)]">Gate error: {error}</div>;
  if (gate === null) return <div data-testid="gate-empty" className="text-sm text-[var(--muted)]">No pending gate.</div>;
  // Derive G1 props from the gate payload + paper metadata. The page
  // (not this client) owns the full provenance block, so the cockpit
  // fills the placeholder fields from the gate payload when the page
  // hasn't supplied them yet.
  const payload = (gate.payload as Record<string, unknown>) ?? {};
  // Qodo #10 — repoOwner must come from the wire payload (the
  // verifier upstream). When it's missing, the card cannot satisfy
  // the identity confirm: we pass an empty expectedOwner so the
  // typed-match check never succeeds and the Allow button stays
  // disabled until the upstream supplies the real owner.
  const expectedOwner =
    typeof payload.repoOwner === "string" && payload.repoOwner.length > 0
      ? payload.repoOwner
      : "";
  const provenance = {
    arxivId: typeof payload.arxivId === "string" ? payload.arxivId : "",
    title,
    authors: Array.isArray(payload.authors) ? (payload.authors as string[]) : [],
    fetchedAt: typeof payload.fetchedAt === "string" ? payload.fetchedAt : new Date().toISOString(),
    sourceUrl: typeof payload.sourceUrl === "string" ? payload.sourceUrl : "",
    sourceSha256: typeof payload.sourceSha256 === "string" ? payload.sourceSha256 : "",
    repoUrl: typeof payload.repoUrl === "string" ? payload.repoUrl : "",
    repoCommitSha: typeof payload.repoCommitSha === "string" ? payload.repoCommitSha : "0000000",
  };
  const intent = typeof payload.intent === "string" ? payload.intent : "Run the paper's verification command in a disposable sandbox.";
  // Qodo #11 — read the budget + envelope from the wire payload.
  // Hardcoded demo values misrepresent the real sandbox; if the
  // payload doesn't supply a value, render "—" so the operator
  // sees the spec is not specified rather than trusting fiction.
  const budget = {
    cpu: typeof payload.cpu === "string" ? payload.cpu : "—",
    ram: typeof payload.ram === "string" ? payload.ram : "—",
    disk: typeof payload.disk === "string" ? payload.disk : "—",
    wallClock: typeof payload.wallClock === "string" ? payload.wallClock : "—",
    networkMode: typeof payload.networkMode === "string" ? payload.networkMode : "—",
    egressAllowlist: Array.isArray(payload.egressAllowlist)
      ? (payload.egressAllowlist as string[])
      : [],
  };
  const envelope = {
    hypervisor: typeof payload.hypervisor === "string" ? payload.hypervisor : "—",
    baseImageDigest: typeof payload.baseImageDigest === "string" ? payload.baseImageDigest : "—",
    seccompProfile: typeof payload.seccompProfile === "string" ? payload.seccompProfile : "—",
    uid: typeof payload.uid === "string" ? payload.uid : "—",
    mounts: typeof payload.mounts === "string" ? payload.mounts : "—",
    ephemeral: typeof payload.ephemeral === "string" ? payload.ephemeral : "—",
  };
  // Data scope + persistence are static copy from the spec (the
  // contract is fixed: the sandbox can never see ~/.ssh, etc.).
  // But they can be overridden by the payload if the verifier
  // surfaces a tighter set.
  const dataScope =
    typeof payload.dataScope === "string"
      ? payload.dataScope
      : "Files readable: /workspace, /tmp. Cannot read ~/.ssh, ~/.aws, browser profile, or home directory.";
  const persistence =
    typeof payload.persistence === "string"
      ? payload.persistence
      : "Nothing survives this run except stdout/stderr log, the workspace tarball, and Postgres rows tagged with run_id.";

  async function postDecision(decision: "allow" | "deny", reason?: string) {
    if (!gate) return;
    const gateId = gate.id;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/agent/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gateId, decision, reason }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error ?? `HTTP ${r.status}`);
      }
      if (decision === "allow") onAllowed();
      else onDenied();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const gateForCard = {
    id: String(gate.id),
    tool_name: String(gate.tool_name),
    thread_id: String(gate.thread_id),
    tool_call_id: String(gate.tool_call_id),
    payload: payload as Record<string, unknown>,
    status: String(gate.status),
    expires_at: String(gate.expires_at),
  };
  const askReason = (): string | undefined =>
    typeof window !== "undefined" ? window.prompt("Reason (optional):") ?? undefined : undefined;

  // Qodo #7 — route to the right card by gate.kind. The default is
  // verify (the only kind emitted today), but publish/save cards
  // exist and are reachable as soon as a real adapter writes one
  // with `gateKind: "publish" | "save"` in the event payload.
  const kind = String(gate.kind ?? "verify");
  if (kind === "publish") {
    const beforeNum = Number(payload.beforeClaimed ?? payload.claimedValue ?? 0);
    const afterNum = Number(payload.afterReproduced ?? payload.reproducedValue ?? 0);
    return (
      <PublishCard
        gate={gateForCard}
        before={{ label: "Claimed", value: Number.isFinite(beforeNum) ? beforeNum.toFixed(1) : "—" }}
        after={{ label: "Reproduced", value: Number.isFinite(afterNum) ? afterNum.toFixed(1) : "—" }}
        exportPath={`/paper/${slug}/export`}
        onAllow={() => { void postDecision("allow"); }}
        onDeny={() => { void postDecision("deny", askReason()); }}
      />
    );
  }
  if (kind === "save") {
    const annotations = Array.isArray(payload.annotations)
      ? (payload.annotations as Array<{ id: string; text: string }>)
      : [];
    return (
      <SaveCard
        gate={gateForCard}
        annotations={annotations}
        onAllow={() => { void postDecision("allow"); }}
        onDeny={() => { void postDecision("deny", askReason()); }}
      />
    );
  }
  return (
    <VerifyCard
      gate={gateForCard}
      expectedOwner={expectedOwner}
      provenance={provenance}
      intent={intent}
      budget={budget}
      envelope={envelope}
      dataScope={dataScope}
      persistence={persistence}
      onAllow={() => { void postDecision("allow"); }}
      onDeny={() => { void postDecision("deny", askReason()); }}
      onEdit={() => { window.location.href = `/paper/${slug}/audit`; }}
      onKillSwitch={() => { void postDecision("deny", "killed by user"); }}
    />
  );
}

