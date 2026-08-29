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
import { Pill } from "../Pill";

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
  //
  // The hold timer must NOT live in an effect keyed on `props`: the
  // parent re-renders mid-press (cockpit heartbeat, panel state), and
  // a new props object would reset holdStart — the hold could never
  // complete, or could fire onAllow twice. Keep the callback in a ref
  // and key the effect on `holding` alone.
  const onAllowRef = useRef(props.onAllow);
  onAllowRef.current = props.onAllow;
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
    const id = setInterval(() => {
      // Qodo review #9 — a hold in progress must not fire past the
      // TTL: if the countdown reaches zero mid-hold, cancel it (the
      // server rejects stale approvals atomically as well).
      if (Date.now() >= new Date(props.gate.expires_at).getTime()) {
        clearInterval(id);
        holdTimer.current = null;
        setHolding(false);
        setHoldProgress(0);
        return;
      }
      const elapsed = Date.now() - (holdStart.current ?? Date.now());
      const pct = Math.min(100, (elapsed / HOLD_FOR_MS) * 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        clearInterval(id);
        holdTimer.current = null;
        onAllowRef.current();
      }
    }, 50);
    holdTimer.current = id;
    return () => {
      clearInterval(id);
    };
  }, [holding]);

  const seconds = Math.max(0, Math.floor((new Date(gate.expires_at).getTime() - now) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const countdown = `${m}:${s.toString().padStart(2, "0")}`;

  const ownerMatch = typedOwner.trim() === expectedOwner.trim();
  const riskFlags: RiskFlag[] = deriveRiskFlags(gate.payload);
  const riskN = highRiskCount(riskFlags);

  // Expired path flips the card into a clean disabled state. Qodo
  // #9 — `decided` must be true when the countdown has reached 0
  // even before the server flips the row, otherwise a pending row
  // at 0:00 still accepts Allow/Deny and Verify can finish a hold
  // after expiry.
  const expired = gate.status === "expired" || seconds === 0;
  const decided = gate.status !== "pending" || expired;

  return (
    <article
      data-testid="verify-card"
      data-gate-id={gate.id}
      className="card"
      style={{ borderColor: "var(--color-destructive)", borderWidth: 2 }}
    >
      {/* Chrome header */}
      <header
        className="flex items-center justify-between border-b border-[var(--color-border)] pb-2"
        data-testid="verify-header"
      >
        <div className="text-sm font-medium">
          <span className="rcp-eyebrow" style={{ borderColor: "var(--color-destructive)", color: "var(--color-destructive)" }}>
            <span className="rcp-eyebrow-dot" style={{ background: "var(--color-destructive)" }} aria-hidden="true" />
            Verify gate
          </span>{" "}
          <span data-testid="verify-severity">irreversible</span>{" · "}
          <span data-testid="verify-countdown">expires in {countdown}</span>
        </div>
        <div className="text-xs text-[var(--color-muted-foreground)] font-mono" data-testid="verify-tool">
          tool: {gate.tool_name}
        </div>
      </header>

      {/* G1 #1 — Provenance */}
      <details open data-testid="g1-provenance" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">1 · Provenance</h4>
        </summary>
        <div className="g1-section-body">
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
              <span className="text-[var(--color-muted-foreground)]">(sha256 {props.provenance.sourceSha256.slice(0, 12)}…)</span>
            </dd>
            <dt>Repo</dt>
            <dd className="break-all">
              {props.provenance.repoUrl}{" "}
              <span className="text-[var(--color-muted-foreground)]">@{props.provenance.repoCommitSha.slice(0, 7)}</span>
            </dd>
          </dl>
        </div>
      </details>

      {/* G1 #2 — Intent */}
      <details open data-testid="g1-intent" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">2 · Declared intent</h4>
        </summary>
        <div className="g1-section-body">
          <p className="mt-1 text-sm text-[var(--color-foreground)]">{props.intent}</p>
        </div>
      </details>

      {/* G1 #3 — Command */}
      <details open data-testid="g1-command" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">3 · Command (verbatim)</h4>
        </summary>
        <div className="g1-section-body">
          <pre className="mt-1 rounded bg-[var(--color-secondary)] p-2 text-xs font-mono whitespace-pre-wrap break-all text-[var(--color-foreground)]">
            {String(gate.payload?.command ?? gate.tool_name)}
          </pre>
        </div>
      </details>

      {/* G1 #4 — Resource budget */}
      <details open data-testid="g1-budget" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">4 · Resource budget</h4>
        </summary>
        <div className="g1-section-body">
          <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
            <li>CPU: {props.budget.cpu}</li>
            <li>RAM: {props.budget.ram}</li>
            <li>Disk: {props.budget.disk}</li>
            <li>Wall clock: {props.budget.wallClock}</li>
            <li>Network: {props.budget.networkMode}</li>
            <li>Egress allowlist: {props.budget.egressAllowlist.join(", ") || "—"}</li>
          </ul>
        </div>
      </details>

      {/* G1 #5 — Sandbox envelope */}
      <details open data-testid="g1-envelope" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">5 · Sandbox envelope</h4>
        </summary>
        <div className="g1-section-body">
          <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
            <li>Hypervisor: {props.envelope.hypervisor}</li>
            <li>Base image: <span className="font-mono text-xs">{props.envelope.baseImageDigest}</span></li>
            <li>Seccomp: {props.envelope.seccompProfile}</li>
            <li>UID: {props.envelope.uid}</li>
            <li>Mounts: {props.envelope.mounts}</li>
            <li>Ephemeral: {props.envelope.ephemeral}</li>
          </ul>
        </div>
      </details>

      {/* G1 #6 — Risk flags (auto) */}
      <details open data-testid="g1-risk-flags" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)] flex items-center gap-2">
            <span>6 · Risk flags (auto)</span>
            {riskN > 0 && (
              <Pill tone="bad" data-testid="verify-risk-count" style={{ borderColor: "var(--color-destructive)", color: "var(--color-destructive)" }}>
                {riskN} high
              </Pill>
            )}
          </h4>
        </summary>
        <div className="g1-section-body">
          <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
            {riskFlags.map((f) => (
              <li key={f.key} data-testid={`risk-flag-${f.key}`} data-present={f.present ? "true" : "false"} className={f.present ? "text-[var(--color-foreground)]" : "text-[var(--color-muted-foreground)]"}>
                <span className="font-mono mr-1" aria-hidden="true">{f.present ? "!" : "·"}</span>
                {f.label}
                {f.detail && <span className="ml-1 text-[var(--color-muted-foreground)]">— {f.detail}</span>}
              </li>
            ))}
          </ul>
        </div>
      </details>

      {/* G1 #7 — Data scope */}
      <details open data-testid="g1-data-scope" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">7 · Data scope</h4>
        </summary>
        <div className="g1-section-body">
          <p className="mt-1 text-sm text-[var(--color-foreground)]">{props.dataScope}</p>
        </div>
      </details>

      {/* G1 #8 — Persistence */}
      <details open data-testid="g1-persistence" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">8 · Persistence</h4>
        </summary>
        <div className="g1-section-body">
          <p className="mt-1 text-sm text-[var(--color-foreground)]">{props.persistence}</p>
        </div>
      </details>

      {/* G1 #9 — Kill switch */}
      <details open data-testid="g1-kill-switch" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">9 · Kill switch</h4>
        </summary>
        <div className="g1-section-body">
          <button
            type="button"
            onClick={props.onKillSwitch}
            data-testid="verify-kill"
            disabled={decided}
            className="btn btn-destructive mt-1"
            style={{ minHeight: 44, padding: "0.625rem 0.875rem" }}
          >
            ⛔ Abort pending tool call
          </button>
        </div>
      </details>

      {/* G1 #10 — Identity confirm */}
      <details open data-testid="g1-identity" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">
            10 · Identity confirm — type{" "}
            <code className="font-mono text-[var(--color-foreground)]">
              {expectedOwner || "(repo owner not supplied — Allow is disabled)"}
            </code>{" "}
            and hold Allow for 3s
          </h4>
        </summary>
        <div className="g1-section-body">
          <input
            type="text"
            value={typedOwner}
            onChange={(e) => setTypedOwner(e.target.value)}
            placeholder={expectedOwner}
            disabled={decided}
            data-testid="verify-owner-input"
            className="input mt-1.5"
            style={{ fontFamily: "var(--font-mono)" }}
          />
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {ownerMatch ? "Owner matches." : "Type the exact repo owner to enable Allow."}
          </p>
        </div>
      </details>

      {/* G1 #11 — Liability */}
      <details open data-testid="g1-liability" className="g1-section mt-4">
        <summary>
          <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">11 · Liability</h4>
        </summary>
        <div className="g1-section-body">
          <p className="mt-1 text-sm text-[var(--color-foreground)]">
            By allowing, you authorise the agent to execute the command above inside a
            disposable sandbox. The agent has no access to your home directory, browser
            profile, or any secrets. You may deny at any time; the affected claims will be
            marked unverified.
          </p>
        </div>
      </details>

      {/* Actions */}
      <footer className="mt-6 flex items-center gap-2 border-t border-[var(--color-border)] pt-3 flex-wrap">
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
          className="relative overflow-hidden"
          style={{
            background: "var(--good)",
            color: "black",
            padding: "0.5rem 1rem",
            fontFamily: "var(--font-sans)",
            fontSize: "0.875rem",
            fontWeight: 500,
            borderRadius: "var(--radius-md)",
            border: "1px solid transparent",
            cursor: (!ownerMatch || decided) ? "not-allowed" : "pointer",
            opacity: (!ownerMatch || decided) ? 0.4 : 1,
          }}
        >
          {holding && (
            <span
              className="absolute inset-y-0 left-0"
              style={{ width: `${holdProgress}%`, background: "rgba(0,0,0,0.3)" }}
              data-testid="verify-allow-fill"
            />
          )}
          <span style={{ position: "relative" }}>
            {decided ? "Decided" : holding ? `Hold… ${Math.round(holdProgress)}%` : "Allow"}
          </span>
        </button>
        <button
          type="button"
          onClick={props.onEdit}
          disabled={decided}
          data-testid="verify-edit"
          className="btn btn-secondary"
          style={{ minHeight: 44, padding: "0.625rem 0.875rem" }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={props.onDeny}
          disabled={decided}
          data-testid="verify-deny"
          className="btn btn-destructive"
          style={{ minHeight: 44, padding: "0.625rem 0.875rem" }}
        >
          Deny
        </button>
        {expired && (
          <span data-testid="verify-expired" className="ml-2 text-xs text-[var(--color-destructive)]" role="status">
            Approval expired — restart verification.
          </span>
        )}
      </footer>
    </article>
  );
}
