"use client";

// Phase 5.1 — the Halt control. One button, two states, no third
// state (P6): running/queued shows "⏸ Pause" (suspends the run);
// paused shows "⏹ Stop" (terminates and locks); done/error/halted
// shows a locked, non-interactive label. Success reloads the cockpit
// so the papers row (halted/status) and the SSE attachment re-sync.

import { useState } from "react";

export function HaltButton({
  paperId,
  status,
  halted,
}: {
  paperId: string;
  status: string;
  halted: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (action: "pause" | "stop") => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/agent/halt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId, action }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (halted) {
    return (
      <span
        className="rounded border border-[var(--border)] px-2 py-1 text-[var(--muted)]"
        data-testid="halt-btn"
        data-state="locked"
        title="Run halted — locked"
      >
        ⏹ Stopped
      </span>
    );
  }
  if (status === "done" || status === "error") {
    return (
      <span
        className="rounded border border-[var(--border)] px-2 py-1 text-[var(--muted)]"
        data-testid="halt-btn"
        data-state="locked"
      >
        ⏹ {status === "error" ? "Errored" : "Done"}
      </span>
    );
  }

  const paused = status === "paused";
  const action: "pause" | "stop" = paused ? "stop" : "pause";
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={busy}
        data-testid="halt-btn"
        data-state={paused ? "stop" : "pause"}
        onClick={() => void post(action)}
        className="rounded border border-[var(--border)] px-2 py-1 disabled:opacity-50"
      >
        {paused ? "⏹ Stop" : "⏸ Pause"}
      </button>
      {error && (
        <span className="text-xs text-[var(--bad)]" data-testid="halt-error">
          {error}
        </span>
      )}
    </span>
  );
}
