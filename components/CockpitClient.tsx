"use client";

// Workspace redesign — the /paper/[slug] cockpit is a 3-pane workspace:
//
//   1. Header (one line): back link · paper title · status chip with a
//      disclosure holding the status sentence + run facts (tokens,
//      sandbox) · cap chip · halt. Nothing wraps on desktop.
//   2. Pipeline strip: the six stations, thin, only while the run is
//      live (running/paused); hidden entirely once the run is done. The
//      paused note rides inline in the strip.
//   3. Workspace grid: PDF pane (~40%) · Analysis pane (~35%, tabs:
//      Summary + Authors folded in · Claims · Graphs · Audit) · Chat
//      pane (~25%).
//   4. The chat pane is the harness: the agent's run log streams there,
//      approval gates render as collapsible cards (chat-only — no
//      full-width banner), and the Ask composer stays docked at the
//      bottom. One surface carries everything the agent is doing.
//   5. Mobile (<1024px): one visible pane + a bottom segmented switcher
//      (Paper | Analysis | Chat), pure CSS over a data attribute; a
//      pausing run auto-switches to Chat so the gate is never missed.
//
// Test contracts preserved: cockpit, status-row, status-verb, trail-pills,
// coverage-grid, pulse, sandbox-id, tokens-fact, tabs, tab-*, summary-tab,
// authors-tab, claims-tab, gate-panel, gate-paused-note, gate-error,
// gate-empty, cap-chip, halt-btn, ask-*, reader-*, confidence-chip,
// claim-row, author-card and their data attributes.

import "./cockpit.css";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Pulse } from "./pulse";
import { Tabs, type TabId } from "./tabs";
import { Summary } from "./tabs/summary";
import { Authors } from "./tabs/authors";
import { Claims } from "./tabs/claims";
import { Graphs } from "./tabs/graphs";
import { Reader } from "./reader";
import { Ask } from "./ask";
import { VerifyCard } from "./gates/verify-card";
import { PublishCard } from "./gates/publish-card";
import { SaveCard } from "./gates/save-card";
import { HaltButton } from "./halt-button";
import { CapChip } from "./cap-chip";
import { AuditPanel } from "./audit-panel";
import type { Claim } from "../lib/claims";
import type { LiveState, TrailPill } from "../lib/event-reducer";

const STATION_COPY: Record<string, string> = {
  source: "Fetched the paper",
  parse: "Read every page",
  extract: "Pulled out the claims",
  score: "Checked the claims",
  verify: "Reproving in a sandbox",
  done: "Finished",
};

function statusVerb(state: LiveState): string {
  if (state.status === "queued") return "Queued — waiting for the first event.";
  if (state.status === "running") return "Reading the paper now.";
  if (state.status === "paused") {
    const gates = state.gates.length;
    return `Paused — it needs your approval before the next step${gates > 1 ? ` (${gates} pending)` : ""}.`;
  }
  if (state.status === "error") return "Something failed — the run log has the detail.";
  return "Done — here is what it found.";
}

// The chip carries the one-word verb; the full sentence lives in the
// disclosure so the header stays one line tall.
const STATUS_WORD: Record<LiveState["status"], string> = {
  queued: "Queued",
  running: "Running",
  paused: "Paused",
  error: "Errored",
  done: "Done",
};

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
  halted?: boolean;
  capUsd?: number | null;
  capTokens?: number | null;
};

const WORKSPACE_PANES = [
  { id: "paper", label: "Paper" },
  { id: "analysis", label: "Analysis" },
  { id: "chat", label: "Chat" },
] as const;
type WorkspacePane = (typeof WORKSPACE_PANES)[number]["id"];

const ANALYSIS_ORDER: TabId[] = ["summary", "claims", "graphs", "audit"];

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
  const [runPanelOpen, setRunPanelOpen] = useState(false);
  const [gateWindowOpen, setGateWindowOpen] = useState(true);
  const [pane, setPane] = useState<WorkspacePane>("paper");
  // Tracks the paused→unpaused edge so a pausing run flips the mobile
  // switcher to Chat exactly once per pause episode (never on re-renders).
  const wasPausedRef = useRef(false);

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

  const paused = liveState.status === "paused";
  // The strip only earns its row while the run is live. Done papers go
  // straight to the report.
  const stripVisible = liveState.status !== "done";

  // Mobile: when the run pauses, the gate is the one thing that needs
  // the user — bring the Chat pane (which hosts the approval card)
  // forward. Desktop ignores this; all three panes are visible there.
  useEffect(() => {
    if (paused && !wasPausedRef.current && viewportWidth < 1024) {
      setPane("chat");
    }
    wasPausedRef.current = paused;
  }, [paused, viewportWidth]);

  return (
    <div className="page-wide cockpit-ws" data-testid="cockpit">
      {/* 1 · Header — which paper, what is happening, one line. */}
      <header className="ws-header">
        <a
          href="/dashboard"
          className="ws-back no-underline hover:underline"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          ← All papers
        </a>
        <div className="ws-heading">
          <h1 className="ws-title">{title}</h1>
          <span className="ws-slug">{slug}</span>
        </div>

        <div className="ws-header-actions">
          {/* Status chip + a disclosure for the status sentence and the
              run facts. The log itself streams in the Chat pane — the
              harness — not here. */}
          <div className="status-chip" data-testid="status-row" data-status={liveState.status}>
            <span className="status-chip-face" data-state={liveState.status}>
              <span className="status-chip-dot" aria-hidden="true" />
              <strong data-testid="status-verb">{STATUS_WORD[liveState.status]}</strong>
            </span>
            <button
              type="button"
              className="status-toggle"
              aria-expanded={runPanelOpen}
              aria-controls="run-panel"
              onClick={() => setRunPanelOpen((v) => !v)}
            >
              Details <span aria-hidden="true" className="status-caret">{runPanelOpen ? "▴" : "▾"}</span>
            </button>
            <div id="run-panel" className="status-panel" data-open={runPanelOpen ? "true" : "false"}>
              <p className="status-panel-note">{statusVerb(liveState)}</p>
              <dl className="run-facts" aria-label="Run facts">
                <div className="flex justify-between gap-2">
                  <dt>Tokens used</dt>
                  <dd data-testid="tokens-fact">{liveState.metrics.totalTokens.toLocaleString()}</dd>
                </div>
                {liveState.sandboxId && (
                  <div className="flex justify-between gap-2">
                    <dt>Sandbox</dt>
                    <dd data-testid="sandbox-id">{liveState.sandboxId}</dd>
                  </div>
                )}
              </dl>
              <p className="status-panel-foot">The agent runs only what you approve.</p>
            </div>
          </div>

          <CapChip
            capUsd={capUsd}
            capTokens={capTokens}
            totalTokens={liveState.metrics.totalTokens}
            costDisplay={liveState.metrics.costDisplay}
          />
          <HaltButton paperId={paperId} status={liveState.status} halted={halted} />
        </div>
      </header>

      {/* 2 · Pipeline strip — where the run is. Gone once it's done. */}
      {stripVisible && (
        <section aria-label="Pipeline progress" className="ws-strip">
          <ol className="pipeline" data-testid="trail-pills">
            {pills.map((p, i) => (
              <li key={p.id} className="contents" data-state={p.state} data-pill={p.id}>
                {i > 0 && <span aria-hidden="true" className="pipeline-link" />}
                <span
                  className="pipeline-station"
                  data-state={p.state}
                  title={STATION_COPY[p.id] ?? undefined}
                >
                  <span className="pipeline-dot" aria-hidden="true" />
                  {p.label}
                </span>
              </li>
            ))}
          </ol>
          {paused && (
            <p className="cockpit-paused-note" data-testid="gate-paused-note">
              <span aria-hidden="true">⏸</span>
              The agent stopped at an approval gate. Nothing runs until you allow it.
            </p>
          )}
        </section>
      )}

      {/* 3 · The workspace: paper left, analysis center, chat right.
              On <1024px each pane shows alone; the switcher picks which. */}
      <div className="ws-grid" data-mobile-pane={pane}>
        {/* PDF pane — the paper itself. */}
        <section className="ws-pane ws-pane-pdf" data-active={pane === "paper"} aria-label="Paper">
          <div className="ws-pane-head">
            <span className="ws-eyebrow">Paper</span>
          </div>
          <div className="pdf-body">
            {pdfUrl ? (
              <object data={pdfUrl} type="application/pdf" title={title} className="pdf-frame">
                <iframe src={pdfUrl} title={title} className="pdf-frame" />
              </object>
            ) : (
              <div className="pdf-empty">
                <span className="pdf-empty-mark" aria-hidden="true" />
                <p>The PDF appears here once the run sources the paper.</p>
              </div>
            )}
          </div>
        </section>

        {/* Analysis pane — the findings. Authors fold under the summary. */}
        <section className="ws-pane ws-pane-analysis" data-active={pane === "analysis"} aria-label="Analysis">
          <div className="ws-pane-scroll">
            <Tabs
              slug={slug}
              active={tab}
              onChange={setTab}
              order={ANALYSIS_ORDER}
              panels={{
                summary: (
                  <div>
                    <Summary data={summary} />
                    <div className="ws-authors">
                      <span className="ws-eyebrow">Authors</span>
                      <Authors paperId={paperId} />
                    </div>
                  </div>
                ),
                claims: <ClaimsLoader paperId={paperId} onOpenClaim={setOpenClaim} />,
                graphs: (
                  <Graphs
                    paperId={paperId}
                    coverage={coverage}
                    metrics={liveState.metrics}
                    capUsd={capUsd}
                    capTokens={capTokens}
                    sandboxId={liveState.sandboxId}
                  />
                ),
                audit: (
                  <p className="claims-note">
                    Every step the agent took, in order, with the proof.{" "}
                    <a className="underline" style={{ color: "var(--accent-blue)" }} href={`/paper/${slug}/audit`}>
                      Open the audit timeline
                    </a>.
                  </p>
                ),
              }}
            />
          </div>
        </section>

        {/* Chat pane — the harness. Everything the agent is doing
            streams through here: the approval gate as a collapsible
            card (chat-only, no page-wide banner), the run log tail,
            and the Q&A with the composer docked at the bottom. */}
        <section className="ws-pane ws-pane-chat" data-active={pane === "chat"} aria-label="Chat">
          <div className="ws-pane-head">
            <span className="ws-eyebrow">Harness</span>
          </div>
          <div className="chat-feed">
            {paused && (
              <section
                className="gate-window"
                data-testid="gate-panel"
                data-open={gateWindowOpen ? "true" : "false"}
                aria-label="Approval gate"
              >
                <button
                  type="button"
                  className="gate-window-head"
                  aria-expanded={gateWindowOpen}
                  aria-controls="gate-window-body"
                  onClick={() => setGateWindowOpen((v) => !v)}
                >
                  <span className="gate-window-title">
                    <span aria-hidden="true">⏸</span> Approval needed
                  </span>
                  <span aria-hidden="true" className="gate-window-caret">{gateWindowOpen ? "▾" : "▸"}</span>
                </button>
                <div id="gate-window-body" className="gate-window-body">
                  <VerifyGatePanel
                    paperId={paperId}
                    slug={slug}
                    title={title}
                    onAllowed={() => { window.location.reload(); }}
                    onDenied={() => { window.location.reload(); }}
                  />
                </div>
              </section>
            )}
            <div className="chat-log">
              <span className="ws-eyebrow">Run log</span>
              <Pulse state={liveState} lastHeartbeat={lastHeartbeat} />
            </div>
            <Ask
            paperId={paperId}
            onCite={async (claimId) => {
              if (openClaim?.id === claimId) return;
              try {
                const r = await fetch(`/api/papers/${paperId}/claims`);
                if (!r.ok) return;
                const data = (await r.json()) as { ok: boolean; claims: Claim[] };
                const target = (data.claims ?? []).find((c) => c.id === claimId);
                if (target) {
                  setOpenClaim(target);
                  setTab("claims");
                  setPane("analysis");
                }
              } catch {
                /* best-effort: user can still click the Claims row */
              }
            }}
          />
          </div>
        </section>
      </div>

      {/* 4 · Mobile switcher — segmented, bottom, CSS-shown only <1024px. */}
      <nav className="ws-switcher" aria-label="Workspace panes">
        {WORKSPACE_PANES.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={pane === p.id}
            data-pane-tab={p.id}
            onClick={() => setPane(p.id)}
            className={pane === p.id ? "is-active" : undefined}
          >
            {p.label}
          </button>
        ))}
      </nav>

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
  if (error) return <div className="text-sm text-[var(--color-destructive)]" role="alert">Claims error: {error}</div>;
  if (claims === null) return <div className="claims-note">Loading claims…</div>;
  return <Claims claims={claims} onOpenClaim={onOpenClaim} />;
}

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
  if (error) return <div data-testid="gate-error" className="text-sm text-[var(--color-destructive)]" role="alert">Gate error: {error}</div>;
  if (gate === null) return <div data-testid="gate-empty" className="claims-note">No pending gate.</div>;

  const payload = (gate.payload as Record<string, unknown>) ?? {};
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
      const msg = (e as Error).message;
      // The route 409s when the approval is stale upstream (TrueForge
      // 422 "no pending approval") — it has already marked the gate
      // expired. Tell the user the truth and refresh so the dead card
      // clears instead of looping errors.
      if (/no longer pending/i.test(msg)) {
        setError("This approval is no longer pending — the run already moved on. Refreshing…");
        setTimeout(() => window.location.reload(), 1600);
      } else {
        setError(msg);
      }
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
