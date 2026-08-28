"use client";

// Phase 5.2/5.3 — the "Replay this audit" header action. One click
// creates a NEW TrueForge session for the same paper (fresh sandbox)
// and reloads the cockpit onto the new run.

import { useState } from "react";

export function ReplayButton({ paperId }: { paperId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replay = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/agent/replay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paperId }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      // Reload whatever page we are on: the audit page re-renders with
      // the replay rows, the cockpit reattaches to the new session.
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void replay()}
        disabled={busy}
        data-testid="replay-btn"
        className="rounded border border-[var(--border)] px-3 py-1 text-sm hover:bg-[var(--panel-2)] disabled:opacity-50"
      >
        {busy ? "Replaying…" : "Replay this audit"}
      </button>
      {error && (
        <span className="text-xs text-[var(--bad)]" data-testid="replay-error">
          {error}
        </span>
      )}
    </span>
  );
}
