"use client";

import { useState } from "react";
import type { CiteToken } from "../lib/cite";

export function Ask({
  paperId,
  onCite,
}: {
  paperId: string;
  onCite: (claimId: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || pending) return;
    setPending(true);
    setError(null);
    setAnswer(null);
    try {
      const r = await fetch(`/api/papers/${paperId}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await r.json() as { ok: boolean; answer?: string; error?: string; cites?: CiteToken[] };
      if (!r.ok || !data.ok) {
        setError(data.error ?? `HTTP ${r.status}`);
      } else {
        setAnswer(data.answer ?? "");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  function renderAnswer(text: string) {
    const parts: Array<React.ReactNode> = [];
    const re = /\[claim\s+([0-9a-f-]+)\]/g;
    let lastIndex = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
      const claimId = m[1]!;
      parts.push(
        <button
          key={`cite-${key++}`}
          type="button"
          data-testid="answer-citation"
          data-claim-id={claimId}
          onClick={() => onCite(claimId)}
          className="text-[var(--accent-blue)] underline hover:no-underline bg-transparent border-0 cursor-pointer p-0 font-inherit"
        >
          [cite]
        </button>,
      );
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
    return parts;
  }

  return (
    <form onSubmit={onSubmit} className="mt-8" data-testid="ask-composer">
      <label className="block text-sm text-[var(--color-foreground)]" htmlFor="ask-input">
        Ask anything in this paper
      </label>
      <p className="text-xs text-[var(--color-muted-foreground)]">
        Type a question, or <code className="font-mono">@cite[claim:&lt;id&gt;]</code> to pin a specific one.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          id="ask-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="@cite[claim:<id>] what does this claim say?"
          className="input flex-1"
          style={{ fontFamily: "var(--font-mono)" }}
          data-testid="ask-input"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          aria-busy={pending}
          className="btn btn-primary"
          data-testid="ask-submit"
        >
          {pending && <span className="btn-spinner" aria-hidden="true" />}
          <span>{pending ? "Asking" : "Ask"}</span>
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm text-[var(--color-destructive)]" data-testid="ask-error" role="alert">
          {error}
        </p>
      )}
      {answer !== null && (
        <div
          className="mt-3 card text-sm whitespace-pre-wrap"
          data-testid="ask-answer"
        >
          {renderAnswer(answer)}
        </div>
      )}
    </form>
  );
}
