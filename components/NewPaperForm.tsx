"use client";

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
    if (!source.trim()) {
      setError("Enter a PDF path or arXiv URL.");
      return;
    }
    startTransition(async () => {
      const createRes = await fetch("/api/papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, mode }),
      });
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not create paper.");
        return;
      }
      const created = (await createRes.json()) as { paperId?: string; slug?: string };
      if (!created.paperId || !created.slug) {
        setError("Paper create returned no id.");
        return;
      }
      const startRes = await fetch("/api/agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperId: created.paperId,
          mode,
          source,
        }),
      });
      if (!startRes.ok) {
        const body = (await startRes.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not start agent.");
        return;
      }
      const started = (await startRes.json()) as { slug?: string };
      if (started.slug) router.push(`/paper/${started.slug}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-8" data-testid="new-paper-form">
      <section>
        <span className="rcp-eyebrow">Source</span>
        <div className="mt-3 card">
          <p className="text-sm text-[var(--color-foreground)]">
            Drop a PDF or paste an arXiv URL.
          </p>
          <input
            type="text"
            name="source"
            placeholder="https://arxiv.org/abs/1706.03762"
            aria-label="Paper source URL or path"
            className="input mt-3"
            style={{ fontFamily: "var(--font-mono)" }}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
      </section>

      <section>
        <span className="rcp-eyebrow">Mode</span>
        <div
          className="mt-3 inline-flex rounded border border-[var(--color-border)] bg-[var(--color-card)] p-1"
          role="radiogroup"
          aria-label="Paper mode"
        >
          {MODES.map((m) => {
            const selected = mode === m.id;
            return (
              <button
                type="button"
                key={m.id}
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(m.id)}
                data-testid={`mode-${m.id}`}
                title={m.blurb}
                className="px-3 py-1.5 text-sm font-sans rounded transition-colors"
                style={{
                  background: selected ? "var(--color-primary)" : "transparent",
                  color: selected ? "var(--color-primary-foreground)" : "var(--color-foreground)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
          {MODES.find((m) => m.id === mode)?.blurb}
        </p>
      </section>

      {error && (
        <p className="text-sm text-[var(--color-destructive)]" role="alert">{error}</p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          data-testid="new-paper-submit"
          className="btn btn-primary"
        >
          {pending && <span className="btn-spinner" aria-hidden="true" />}
          <span>{pending ? "Starting" : "Start"}</span>
        </button>
      </div>
    </form>
  );
}
