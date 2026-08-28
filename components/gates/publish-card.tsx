// Phase 4.3 — Publish gate card.
//
// The Publish gate is **irreversible** and gates the Review-mode
// markdown draft download. The card shows a before/after diff with
// a single highlighted delta line (e.g. "Reproduced 91.7% (claimed
// 92.4%, Δ −0.7)"). Allow unlocks `/paper/:slug/export`; Deny leaves
// the export locked with clear copy.
//
// The diff payload is constructed by the verifier upstream and
// passed in via `gate.payload` — the card renders it verbatim, no
// derivation from LLM prose.

import { useEffect, useState } from "react";

export type PublishCardProps = {
  gate: {
    id: string;
    tool_name: string;
    status: string;
    payload: Record<string, unknown> | null;
    expires_at: string;
  };
  // Before/after values for the diff line. The plan example is
  // "Reproduced 91.7% (claimed 92.4%, Δ −0.7)"; we render it as
  // before → after + a sign-aware delta.
  before: { label: string; value: string };
  after: { label: string; value: string };
  exportPath: string; // e.g. /paper/:slug/export
  onAllow: () => void;
  onDeny: (reason?: string) => void;
};

function numDelta(before: string, after: string): string {
  const b = Number(before);
  const a = Number(after);
  if (!Number.isFinite(b) || !Number.isFinite(a)) return "";
  const d = a - b;
  const sign = d > 0 ? "+" : "";
  return `Δ ${sign}${d.toFixed(1)}`;
}

export function PublishCard(props: PublishCardProps) {
  const { gate } = props;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((new Date(gate.expires_at).getTime() - now) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const countdown = `${m}:${s.toString().padStart(2, "0")}`;
  const delta = numDelta(props.before.value, props.after.value);
  const expired = gate.status === "expired" || seconds === 0;
  // Qodo #9 — disable Allow/Deny when the countdown has reached 0
  // even before the server flips the row.
  const decided = gate.status !== "pending" || expired;

  return (
    <article
      data-testid="publish-card"
      data-gate-id={gate.id}
      className="rounded border-2 border-[var(--bad)] bg-[var(--panel)] p-4"
    >
      <header
        className="flex items-center justify-between border-b border-[var(--border)] pb-2"
        data-testid="publish-header"
      >
        <div className="text-sm font-medium">
          ◀ Publish gate ·{" "}
          <span data-testid="publish-severity" data-severity="irreversible">
            irreversible
          </span>{" "}
          · <span data-testid="publish-countdown">expires in {countdown}</span>
        </div>
      </header>

      <section data-testid="publish-diff" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">Diff</h3>
        <div className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
          <div data-testid="publish-before">
            <div className="text-[var(--muted)]">{props.before.label}</div>
            <div className="font-mono text-base">{props.before.value}</div>
          </div>
          <div data-testid="publish-after">
            <div className="text-[var(--muted)]">{props.after.label}</div>
            <div className="font-mono text-base">{props.after.value}</div>
          </div>
        </div>
        {delta && (
          <div data-testid="publish-delta" className="mt-2 font-mono text-sm">
            {delta}
          </div>
        )}
      </section>

      <section data-testid="publish-export" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">Export</h3>
        <p className="mt-1 text-sm">
          Allow to unlock the markdown export at{" "}
          <code className="font-mono">{props.exportPath}</code>.
        </p>
      </section>

      <footer className="mt-4 flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={props.onAllow}
          disabled={decided}
          data-testid="publish-allow"
          className="rounded bg-[var(--good)] px-3 py-1 text-sm font-medium text-black disabled:opacity-40"
        >
          {decided ? "Decided" : "Allow"}
        </button>
        <button
          type="button"
          onClick={() => {
            const reason = typeof window !== "undefined" ? window.prompt("Reason (optional):") ?? undefined : undefined;
            props.onDeny(reason);
          }}
          disabled={decided}
          data-testid="publish-deny"
          className="rounded border border-[var(--bad)] px-3 py-1 text-sm text-[var(--bad)] disabled:opacity-40"
        >
          Deny
        </button>
        {expired && (
          <span data-testid="publish-expired" className="ml-2 text-xs text-[var(--bad)]">
            approval expired — restart verification.
          </span>
        )}
      </footer>
    </article>
  );
}
