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
  const expired = gate.status === "expired" || seconds === 0;
  // Qodo #9 — disable Allow/Deny when the countdown has reached 0
  // even before the server flips the row.
  const decided = gate.status !== "pending" || expired;

  return (
    <article
      data-testid="save-card"
      data-gate-id={gate.id}
      className="card"
      style={{ borderColor: "var(--warn)", borderWidth: 2 }}
    >
      <header
        className="flex items-center justify-between border-b border-[var(--color-border)] pb-2"
        data-testid="save-header"
      >
        <div className="text-sm font-medium">
          <span className="rcp-eyebrow" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
            <span className="rcp-eyebrow-dot" style={{ background: "var(--warn)" }} aria-hidden="true" />
            Save gate
          </span>{" "}
          <span data-testid="save-severity" data-severity="reversible">reversible</span>{" · "}
          <span data-testid="save-countdown">expires in {countdown}</span>
        </div>
        <div data-testid="save-count" className="text-xs text-[var(--color-muted-foreground)]">
          {annotations.length} annotation{annotations.length === 1 ? "" : "s"}
        </div>
      </header>

      <section data-testid="save-list" className="mt-4">
        <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)]">Annotations to merge</h4>
        {annotations.length === 0 ? (
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Nothing to merge.</p>
        ) : (
          <ol className="mt-2 space-y-2 text-sm">
            {annotations.map((a) => (
              <li
                key={a.id}
                data-testid="save-annotation"
                data-annotation-id={a.id}
                className="rounded border border-[var(--color-border)] bg-[var(--color-secondary)] p-2"
              >
                <div className="font-mono text-xs text-[var(--color-muted-foreground)]">{a.id.slice(0, 8)}</div>
                <div className="text-[var(--color-foreground)]">{a.text}</div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className="mt-6 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
        <button
          type="button"
          onClick={props.onAllow}
          disabled={decided}
          data-testid="save-allow"
          style={{
            background: "var(--good)", color: "black",
            padding: "0.5rem 1rem", fontFamily: "var(--font-sans)",
            fontSize: "0.875rem", fontWeight: 500, borderRadius: "var(--radius-md)",
            border: "1px solid transparent", cursor: decided ? "not-allowed" : "pointer",
            opacity: decided ? 0.4 : 1,
          }}
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
          className="btn btn-destructive"
          style={{ minHeight: 44, padding: "0.625rem 0.875rem" }}
        >
          Keep local
        </button>
        {expired && (
          <span data-testid="save-expired" className="ml-2 text-xs text-[var(--color-destructive)]" role="status">
            Approval expired — restart verification.
          </span>
        )}
      </footer>
    </article>
  );
}
