"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseSource } from "../lib/source-parse";

type Mode = "learn" | "deep-read" | "review";

const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "learn", label: "Learn", blurb: "summaries + key terms" },
  { id: "deep-read", label: "Deep-read", blurb: "claims with full evidence" },
  { id: "review", label: "Review", blurb: "full audit + diff + draft" },
];

// Miniature echo of the landing's SectionRule: mono step number in
// the reserved indigo, tracked-caps label, hairline rule to the right.
// One label system per step — no competing eyebrow chip.
function StepRule({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span
        aria-hidden
        className="font-mono text-xs font-medium tracking-[0.08em]"
        style={{ color: "var(--accent-indigo)" }}
      >
        {n}
      </span>
      <span
        className="font-heading text-[0.6875rem] font-medium uppercase tracking-[0.14em]"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        {label}
      </span>
      <span aria-hidden className="h-px flex-1" style={{ background: "var(--color-border)" }} />
    </div>
  );
}

export function NewPaperForm() {
  const router = useRouter();
  const [source, setSource] = useState("");
  const [mode, setMode] = useState<Mode>("review");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Live feedback: does what the user typed resolve to a paper on arXiv?
  const parsedSource = parseSource(source);

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
    <form onSubmit={onSubmit} className="mt-8 space-y-10" data-testid="new-paper-form">
      {/* 01 — Source. The mono field reads like a terminal line; the
          placeholder carries both accepted arXiv forms, so no
          instruction paragraph is needed above it. When the input
          parses as arXiv a quiet hint confirms it was recognized. */}
      <section>
        <StepRule n="01" label="Source" />
        <input
          type="text"
          name="source"
          placeholder="arxiv.org/pdf/2606.19625  ·  arxiv.org/abs/1706.03762  ·  or a local PDF path"
          aria-label="Paper source URL or path"
          className="input"
          style={{ fontFamily: "var(--font-mono)" }}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        {parsedSource.kind === "arxiv" && (
          <p
            className="text-xs mt-2"
            style={{ color: "var(--color-muted-foreground)" }}
            data-testid="arxiv-hint"
          >
            arXiv {parsedSource.id} detected
          </p>
        )}
      </section>

      {/* 02 — Mode. The verb that sets the agent's depth. Blurb
          sits above the toggle so the choice is described, not
          explained after the fact. */}
      <section>
        <StepRule n="02" label="Mode" />
        <p className="text-sm mb-2" style={{ color: "var(--color-muted-foreground)" }}>
          {MODES.find((m) => m.id === mode)?.blurb}
        </p>
        <div
          className="inline-flex rounded border p-1"
          style={{ borderColor: "var(--color-border)", background: "var(--color-card)" }}
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
                className="px-3.5 py-1.5 text-sm rounded transition-colors"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: selected ? 600 : 400,
                  background: selected ? "var(--color-primary)" : "transparent",
                  color: selected ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <p className="text-sm text-[var(--color-destructive)]" role="alert">{error}</p>
      )}

      {/* Footer — the promise sits beside the action it governs.
          The green dot is the same "live" signal as the demo chip
          on /auth; indigo stays reserved for this one CTA. */}
      <div
        className="pt-5 border-t flex items-center justify-between gap-4 flex-wrap"
        style={{ borderColor: "var(--color-border)" }}
      >
        <p className="flex items-center gap-2.5 text-sm" style={{ color: "var(--color-foreground)" }}>
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: "var(--good)", boxShadow: "0 0 0 4px var(--accent-indigo-soft)" }}
            aria-hidden="true"
          />
          Agent ready — it asks before irreversible steps.
        </p>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          data-testid="new-paper-submit"
          className="btn btn-indigo"
        >
          {pending && <span className="btn-spinner" aria-hidden="true" />}
          <span>{pending ? "Starting" : "Start the agent"}</span>
        </button>
      </div>
    </form>
  );
}