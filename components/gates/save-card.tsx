// Phase 4.3 — Save gate card.
//
// The Save gate is **reversible**: bulk-merging annotations from the
// working set into the permanent library. The card lists each
// annotation (id + short text preview) so the user can audit what
// they're about to merge. Allow merges, Deny keeps annotations
// local. The chrome reflects "reversible" (no red border, no
// identity confirm).

import { useEffect, useState } from "react";

export type SaveAnnotation = {
  id: string;
  text: string;
};

export type SaveCardProps = {
  gate: {
    id: string;
    tool_name: string;
    status: string;
    payload: Record<string, unknown> | null;
    expires_at: string;
  };
  annotations: SaveAnnotation[];
  onAllow: () => void;
  onDeny: (reason?: string) => void;
};

export function SaveCard(props: SaveCardProps) {
  const { gate, annotations } = props;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(0, Math.floor((new Date(gate.expires_at).getTime() - now) / 1000));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const countdown = `${m}:${s.toString().padStart(2, "0")}`;
  const decided = gate.status !== "pending";
  const expired = gate.status === "expired" || seconds === 0;

  return (
    <article
      data-testid="save-card"
      data-gate-id={gate.id}
      className="rounded border-2 border-[var(--warn)] bg-[var(--panel)] p-4"
    >
      <header
        className="flex items-center justify-between border-b border-[var(--border)] pb-2"
        data-testid="save-header"
      >
        <div className="text-sm font-medium">
          ◀ Save gate ·{" "}
          <span data-testid="save-severity" data-severity="reversible">
            reversible
          </span>{" "}
          · <span data-testid="save-countdown">expires in {countdown}</span>
        </div>
        <div data-testid="save-count" className="text-xs text-[var(--muted)]">
          {annotations.length} annotation{annotations.length === 1 ? "" : "s"}
        </div>
      </header>

      <section data-testid="save-list" className="mt-3">
        <h3 className="text-xs font-semibold text-[var(--muted)]">Annotations to merge</h3>
        {annotations.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--muted)]">— nothing to merge —</p>
        ) : (
          <ol className="mt-1 space-y-1 text-sm">
            {annotations.map((a) => (
              <li
                key={a.id}
                data-testid="save-annotation"
                data-annotation-id={a.id}
                className="rounded border border-[var(--border)] bg-[var(--panel-2)] p-2"
              >
                <div className="font-mono text-xs text-[var(--muted)]">{a.id.slice(0, 8)}</div>
                <div>{a.text}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="mt-4 flex items-center gap-2 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={props.onAllow}
          disabled={decided}
          data-testid="save-allow"
          className="rounded bg-[var(--good)] px-3 py-1 text-sm font-medium text-black disabled:opacity-40"
        >
          {decided ? "Decided" : "Merge"}
        </button>
        <button
          type="button"
          onClick={() => {
            const reason = typeof window !== "undefined" ? window.prompt("Reason (optional):") ?? undefined : undefined;
            props.onDeny(reason);
          }}
          disabled={decided}
          data-testid="save-deny"
          className="rounded border border-[var(--bad)] px-3 py-1 text-sm text-[var(--bad)] disabled:opacity-40"
        >
          Keep local
        </button>
        {expired && (
          <span data-testid="save-expired" className="ml-2 text-xs text-[var(--bad)]">
            approval expired — restart verification.
          </span>
        )}
      </footer>
    </article>
  );
}
