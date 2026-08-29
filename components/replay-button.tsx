"use client";

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
        className="btn btn-secondary"
        style={{ minHeight: 44, padding: "0.625rem 0.875rem" }}
      >
        {busy ? "Replaying audit…" : "Replay this audit"}
      </button>
      {error && (
        <span className="text-xs text-[var(--color-destructive)]" data-testid="replay-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
