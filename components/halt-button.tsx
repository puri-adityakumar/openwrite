"use client";

import { useState } from "react";
import { Pill } from "./Pill";

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
      <Pill tone="bad" data-testid="halt-btn" data-state="locked" title="Run halted — locked">
        Stopped
      </Pill>
    );
  }
  if (status === "done" || status === "error") {
    return (
      <Pill tone="idle" data-testid="halt-btn" data-state="locked">
        {status === "error" ? "Errored" : "Done"}
      </Pill>
    );
  }

  const paused = status === "paused";
  const action: "pause" | "stop" = paused ? "stop" : "pause";
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        data-testid="halt-btn"
        data-state={paused ? "stop" : "pause"}
        onClick={() => void post(action)}
        className="btn btn-secondary"
        style={{ minHeight: 44, padding: "0.5rem 0.75rem" }}
      >
        {paused ? "⏹ Stop" : "⏸ Pause"}
      </button>
      {error && (
        <span className="text-xs text-[var(--color-destructive)]" data-testid="halt-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
