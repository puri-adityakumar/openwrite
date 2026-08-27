// Phase 4.2 — Verify gate card (the G1 spec).
//
// This is the only place the G1 spec is rendered. docs/approval-gates.md
// enumerates 11 items; this component renders every one with a stable
// data-testid so the TC-1 E2E can enumerate them. The card is purely
// presentational + interactive; persistence lives in /api/agent/approve.
//
// G1 items rendered (with their test ids):
//   1. provenance  -> g1-provenance
//   2. intent      -> g1-intent
//   3. command     -> g1-command
//   4. budget      -> g1-budget
//   5. envelope    -> g1-envelope
//   6. risk-flags  -> g1-risk-flags (auto from payload.signals)
//   7. data-scope  -> g1-data-scope
//   8. persistence -> g1-persistence
//   9. kill-switch -> g1-kill-switch
//  10. identity    -> g1-identity (typed owner + 3s hold)
//  11. liability   -> g1-liability
//
// Chrome: ◀ Verify gate · irreversible · expires in M:SS
// Actions: [ Allow ] (gated by identity) · [ Edit ] · [ Deny ]

import { useEffect, useRef, useState } from "react";
import { deriveRiskFlags, highRiskCount, type RiskFlag } from "../../lib/risk-flags";

export type VerifyCardProps = {
  // The gate row from /api/agent/gates/[id] (or directly from
  // insertGate). The card reads `tool_name` and `payload` from it.
  gate: {
    id: string;
    tool_name: string;
    thread_id: string;
    tool_call_id: string;
    payload: Record<string, unknown> | null;
    status: string;
    expires_at: string;
  };
  // The expected repo owner for the identity confirm (G1 #10). The
  // user must type this exact string AND press-and-hold Allow for 3s.
  expectedOwner: string;
  // The provenance block (G1 #1) — arXiv id, title, authors, fetch
  // timestamp, source URL + SHA, repo URL + commit SHA. The page
  // (not the card) builds this from the paper row.
  provenance: {
    arxivId?: string;
    title: string;
    authors: string[];
    fetchedAt: string;
    sourceUrl: string;
    sourceSha256: string;
    repoUrl: string;
    repoCommitSha: string;
  };
  // Declared intent (G1 #2). One sentence. The page builds this from
  // the verifier's plan; for now we read it from the gate payload.
  intent: string;
  // Resource budget (G1 #4) — pre-rendered strings the page composes.
  budget: {
    cpu: string;
    ram: string;
    disk: string;
    wallClock: string;
    networkMode: string;
    egressAllowlist: string[];
  };
  // Sandbox envelope (G1 #5).
  envelope: {
    hypervisor: string;
    baseImageDigest: string;
    seccompProfile: string;
    uid: string;
    mounts: string;
    ephemeral: string;
  };
  // Data scope (G1 #7) and persistence (G1 #8) are static copy from
  // the spec — typed here so a copy change is a single-line edit.
  dataScope: string;
  persistence: string;
  // Callbacks
  onAllow: () => void;
  onEdit: () => void;
  onDeny: () => void;
  onKillSwitch: () => void;
};

const HOLD_FOR_MS = 3000;

export function VerifyCard(props: VerifyCardProps) {
  const { gate, expectedOwner } = props;
  const [typedOwner, setTypedOwner] = useState("");
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStart = useRef<number | null>(null);

  // Countdown tick — refresh every 1s so the M:SS label stays live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Press-and-hold: the Allow button stays disabled until typedOwner
  // matches expectedOwner AND the 3s hold completes.
  useEffect(() => {
    if (!holding) {
      if (holdTimer.current) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
      }
      holdStart.current = null;
      return;
    }
    holdStart.current = Date.now();
    holdTimer.current = setInterval(() => {
      const elapsed = Date.now() - (holdStart.current ?? Date.now());
      const pct = Math.min(100, (elapsed / HOLD_FOR_MS) * 100);
      setHoldProgress(pct);
      if (pct >= 100 && holdTimer.current) {
        clearInterval(holdTimer.current);
        holdTimer.current = null;
        props.onAllow();
      }
    }, 50);
    return () => {
      if (holdTimer.current) clearInterval(holdTimer.current);
    };
  }, [holding, props]);

  const seconds = Math.max(0, Math.floor((new Date(gate.expires_at).getTime() - now) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const countdown = `${m}:${s.toString().padStart(2, "0")}`;

  const ownerMatch = typedOwner.trim() === expectedOwner.trim();
  const riskFlags: RiskFlag[] = deriveRiskFlags(gate.payload);
  const riskN = highRiskCount(riskFlags);

  // Expired path flips the card into a clean disabled state.
  const expired = gate.status === "expired" || seconds === 0;
  const decided = gate.status !== "pending";

  return (
    <article
      data-testid="verify-card"
      data-gate-id={gate.id}
      className="rounded border-2 border-[var(--bad)] bg-[var(--panel)] p-4"
    >
      {/* Chrome header */}
      <header
        className="flex items-center justify-between border-b border-[var(--border)] pb-2"
        data-testid="verify-header"
      >
        <div className="text-sm font-medium">
          ◀ Verify gate · <span data-testid="verify-severity">irreversible</span> ·{" "}
          <span data-testid="verify-countdown">expires in {countdown}</span>
        </div>
        <div className="text-xs text-[var(--muted)]" data-testid="verify-tool">
          tool: {gate.tool_name}
        </div>
      </header>

      {/* G1 #1 — Provenance */}
      <section data-testid="g1-provenance" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">1 · Provenance</h3>
        <dl className="mt-1 grid grid-cols-[8rem_1fr] gap-x-2 text-sm">
          {props.provenance.arxivId && (<>
            <dt>arXiv ID</dt><dd>{props.provenance.arxivId}</dd>
          </>)}
          <dt>Title</dt><dd>{props.provenance.title}</dd>
          <dt>Authors</dt><dd>{props.provenance.authors.join(", ")}</dd>
          <dt>Fetched</dt><dd>{props.provenance.fetchedAt}</dd>
          <dt>Source</dt>
          <dd className="break-all">
            {props.provenance.sourceUrl}{" "}
            <span className="text-[var(--muted)]">(sha256 {props.provenance.sourceSha256.slice(0, 12)}…)</span>
          </dd>
          <dt>Repo</dt>
          <dd className="break-all">
            {props.provenance.repoUrl}{" "}
            <span className="text-[var(--muted)]">@{props.provenance.repoCommitSha.slice(0, 7)}</span>
          </dd>
        </dl>
      </section>

      {/* G1 #2 — Intent */}
      <section data-testid="g1-intent" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">2 · Declared intent</h3>
        <p className="mt-1 text-sm">{props.intent}</p>
      </section>

      {/* G1 #3 — Command */}
      <section data-testid="g1-command" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">3 · Command (verbatim)</h3>
        <pre className="mt-1 rounded bg-[var(--panel-2)] p-2 text-xs font-mono whitespace-pre-wrap break-all">
          {String(gate.payload?.command ?? gate.tool_name)}
        </pre>
      </section>

      {/* G1 #4 — Resource budget */}
      <section data-testid="g1-budget" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">4 · Resource budget</h3>
        <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
          <li>CPU: {props.budget.cpu}</li>
          <li>RAM: {props.budget.ram}</li>
          <li>Disk: {props.budget.disk}</li>
          <li>Wall clock: {props.budget.wallClock}</li>
          <li>Network: {props.budget.networkMode}</li>
          <li>Egress allowlist: {props.budget.egressAllowlist.join(", ") || "—"}</li>
        </ul>
      </section>

      {/* G1 #5 — Sandbox envelope */}
      <section data-testid="g1-envelope" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">5 · Sandbox envelope</h3>
        <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
          <li>Hypervisor: {props.envelope.hypervisor}</li>
          <li>Base image: <span className="font-mono text-xs">{props.envelope.baseImageDigest}</span></li>
          <li>Seccomp: {props.envelope.seccompProfile}</li>
          <li>UID: {props.envelope.uid}</li>
          <li>Mounts: {props.envelope.mounts}</li>
          <li>Ephemeral: {props.envelope.ephemeral}</li>
        </ul>
      </section>

      {/* G1 #6 — Risk flags (auto) */}
      <section data-testid="g1-risk-flags" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">
          6 · Risk flags (auto)
          {riskN > 0 && (
            <span data-testid="verify-risk-count" className="ml-2 rounded bg-[var(--bad)] px-1 text-white">
              {riskN} high
            </span>
          )}
        </h3>
        <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
          {riskFlags.map((f) => (
            <li key={f.key} data-testid={`risk-flag-${f.key}`} data-present={f.present ? "true" : "false"}>
              {f.present ? "⚠" : "·"} {f.label}
              {f.detail && <span className="ml-1 text-[var(--muted)]">— {f.detail}</span>}
            </li>
          ))}
        </ul>
      </section>

      {/* G1 #7 — Data scope */}
      <section data-testid="g1-data-scope" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">7 · Data scope</h3>
        <p className="mt-1 text-sm">{props.dataScope}</p>
      </section>

      {/* G1 #8 — Persistence */}
      <section data-testid="g1-persistence" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">8 · Persistence</h3>
        <p className="mt-1 text-sm">{props.persistence}</p>
      </section>

      {/* G1 #9 — Kill switch */}
      <section data-testid="g1-kill-switch" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">9 · Kill switch</h3>
        <button
          type="button"
          onClick={props.onKillSwitch}
          data-testid="verify-kill"
          disabled={decided}
          className="mt-1 rounded border border-[var(--bad)] px-2 py-1 text-xs text-[var(--bad)] disabled:opacity-50"
        >
          ⛔ Abort pending tool call
        </button>
      </section>

      {/* G1 #10 — Identity confirm */}
      <section data-testid="g1-identity" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">
          10 · Identity confirm — type <code className="font-mono">{expectedOwner}</code> and hold Allow for 3s
        </h3>
        <input
          type="text"
          value={typedOwner}
          onChange={(e) => setTypedOwner(e.target.value)}
          placeholder={expectedOwner}
          disabled={decided}
          data-testid="verify-owner-input"
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm font-mono"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          {ownerMatch ? "✓ owner matches" : `type the exact repo owner to enable Allow`}
        </p>
      </section>

      {/* G1 #11 — Liability */}
      <section data-testid="g1-liability" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">11 · Liability</h3>
        <p className="mt-1 text-sm">
          By allowing, you authorise the agent to execute the command above inside a
          disposable sandbox. The agent has no access to your home directory, browser
          profile, or any secrets. You may deny at any time; the affected claims will be
          marked unverified.
        </p>
      </section>

      {/* Actions */}
      <footer className="mt-4 flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onMouseDown={() => ownerMatch && !decided && setHolding(true)}
          onMouseUp={() => setHolding(false)}
          onMouseLeave={() => setHolding(false)}
          onTouchStart={() => ownerMatch && !decided && setHolding(true)}
          onTouchEnd={() => setHolding(false)}
          disabled={!ownerMatch || decided}
          data-testid="verify-allow"
          data-hold-progress={holdProgress}
          className="relative overflow-hidden rounded bg-[var(--good)] px-3 py-1 text-sm font-medium text-black disabled:opacity-40"
        >
          {holding && (
            <span
              className="absolute inset-y-0 left-0 bg-black/30"
              style={{ width: `${holdProgress}%` }}
              data-testid="verify-allow-fill"
            />
          )}
          <span className="relative">
            {decided ? "Decided" : holding ? `Hold… ${Math.round(holdProgress)}%` : "Allow"}
          </span>
        </button>
        <button
          type="button"
          onClick={props.onEdit}
          disabled={decided}
          data-testid="verify-edit"
          className="rounded border border-[var(--border)] px-3 py-1 text-sm disabled:opacity-40"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={props.onDeny}
          disabled={decided}
          data-testid="verify-deny"
          className="rounded border border-[var(--bad)] px-3 py-1 text-sm text-[var(--bad)] disabled:opacity-40"
        >
          Deny
        </button>
        {expired && (
          <span data-testid="verify-expired" className="ml-2 text-xs text-[var(--bad)]">
            approval expired — restart verification.
          </span>
        )}
      </footer>
    </article>
  );
}
