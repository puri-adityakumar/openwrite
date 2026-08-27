"use client";

// Phase 1.3 — /paper/new client form. Owns the source-input + 3-mode
// dial state. Review is the default mode (plan: "the verb the demo
// beats use"). Submit posts to /api/agent/start; until Phase 2 lands
// the route returns 501 and the form surfaces the message.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Mode = "learn" | "deep-read" | "review";

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "learn", label: "Learn", blurb: "summaries + key terms" },
  { id: "deep-read", label: "Deep-read", blurb: "claims with full evidence" },
  { id: "review", label: "Review", blurb: "full audit + diff + draft" },
];

export function NewPaperForm() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<Mode>("review");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, mode }),
      });
      if (res.status === 501) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Agent wiring lands in Phase 2.");
        return;
      }
      if (!res.ok) {
        setError("Could not start agent.");
        return;
      }
      const body = (await res.json()) as { slug?: string };
      if (body.slug) router.push(`/paper/${body.slug}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-6">
      <section>
        <h2 className="text-sm font-medium text-[var(--muted)]">Source</h2>
        <div className="mt-2 rounded border border-[var(--border)] bg-[var(--panel)] p-3">
          <p className="text-sm text-[var(--muted)]">
            Drop a PDF or paste an arXiv URL.
          </p>
          <input
            type="text"
            name="source"
            placeholder="https://arxiv.org/abs/1706.03762"
            aria-label="Paper source URL or path"
            className="mt-2 w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
      </section>
      <section>
        <h2 className="text-sm font-medium text-[var(--muted)]">Mode</h2>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Paper mode">
          {MODES.map((m) => {
            const selected = mode === m.id;
            return (
              <button
                type="button"
                key={m.id}
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(m.id)}
                className={
                  "rounded border p-3 text-left " +
                  (selected
                    ? "border-[var(--accent)] bg-[var(--panel-2)]"
                    : "border-[var(--border)] bg-[var(--panel)] hover:bg-[var(--panel-2)]")
                }
              >
                <div className="font-semibold">{m.label}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{m.blurb}</div>
                {selected && (
                  <div className="mt-2 text-xs text-[var(--accent)]">selected</div>
                )}
              </button>
            );
          })}
        </div>
      </section>
      {error && (
        <p className="text-sm text-[var(--bad)]" role="alert">{error}</p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
        >
          {pending ? "Starting…" : "Start"}
        </button>
      </div>
    </form>
  );
}
