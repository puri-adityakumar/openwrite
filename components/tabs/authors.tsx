"use client";

// Phase 3.1 — Authors tab.
//
// Fetches /api/papers/:id/authors (which proxies to OpenAlex) and
// renders the list with h-index, works, citations, institution, and
// notable works. Cached server-side for the duration of the Node
// process; on the client we just show whatever the server returns.
//
// Loading + error states are pinned so the demo never shows a broken
// empty box.

import { useEffect, useState } from "react";
import type { OpenAlexAuthor } from "../../lib/openalex";

type AuthorEntry = OpenAlexAuthor | { name: string; error: string };

export function Authors({ paperId }: { paperId: string }) {
  const [authors, setAuthors] = useState<AuthorEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/papers/${paperId}/authors`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as { ok: boolean; authors: AuthorEntry[] };
      })
      .then((d) => { if (!cancelled) setAuthors(d.authors ?? []); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [paperId]);

  if (error) {
    return (
      <div data-testid="authors-tab" className="text-sm text-[var(--bad)]">
        Authors unavailable: {error}
      </div>
    );
  }
  if (authors === null) {
    return (
      <div data-testid="authors-tab" className="text-sm text-[var(--muted)]">
        Loading authors…
      </div>
    );
  }
  if (authors.length === 0) {
    return (
      <div data-testid="authors-tab" className="text-sm text-[var(--muted)]">
        No authors listed for this paper.
      </div>
    );
  }
  return (
    <div data-testid="authors-tab" className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {authors.map((a, i) => {
        if ("error" in a) {
          return (
            <div
              key={i}
              data-testid="author-card"
              data-author-name={a.name}
              className="rounded border border-[var(--border)] bg-[var(--panel)] p-3 text-sm"
            >
              <div className="font-semibold">{a.name}</div>
              <div className="text-[var(--muted)] text-xs">{a.error}</div>
            </div>
          );
        }
        return (
          <div
            key={a.id}
            data-testid="author-card"
            data-author-name={a.display_name}
            className="rounded border border-[var(--border)] bg-[var(--panel)] p-3 text-sm"
          >
            <div className="font-semibold">{a.display_name}</div>
            {a.institution && (
              <div className="text-[var(--muted)] text-xs">{a.institution}</div>
            )}
            <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-[var(--muted)]">h-index</dt><dd data-testid="author-h-index">{a.h_index ?? "—"}</dd></div>
              <div><dt className="text-[var(--muted)]">works</dt><dd>{a.works_count.toLocaleString()}</dd></div>
              <div><dt className="text-[var(--muted)]">cited by</dt><dd>{a.cited_by_count.toLocaleString()}</dd></div>
            </dl>
            {a.notable_works.length > 0 && (
              <ul className="mt-2 text-xs text-[var(--muted)] list-disc pl-4">
                {a.notable_works.map((t, j) => <li key={j}>{t}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
