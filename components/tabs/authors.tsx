"use client";

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
      <div data-testid="authors-tab" className="text-sm text-[var(--color-destructive)]" role="alert">
        Authors unavailable: {error}
      </div>
    );
  }
  if (authors === null) {
    return (
      <div data-testid="authors-tab" className="text-sm text-[var(--color-muted-foreground)]">
        Loading authors…
      </div>
    );
  }
  if (authors.length === 0) {
    return (
      <div data-testid="authors-tab" className="text-sm text-[var(--color-muted-foreground)]">
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
              className="card text-sm"
            >
              <div className="font-medium text-[var(--color-foreground)]">{a.name}</div>
              <div className="text-[var(--color-muted-foreground)] text-xs">{a.error}</div>
            </div>
          );
        }
        return (
          <div
            key={a.id}
            data-testid="author-card"
            data-author-name={a.display_name}
            className="card text-sm"
          >
            <div className="font-medium text-[var(--color-foreground)]">{a.display_name}</div>
            {a.institution && (
              <div className="text-[var(--color-muted-foreground)] text-xs">{a.institution}</div>
            )}
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <dt className="text-[var(--color-muted-foreground)]">h-index</dt>
                <dd data-testid="author-h-index" className="text-[var(--color-foreground)]">{a.h_index ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted-foreground)]">works</dt>
                <dd className="text-[var(--color-foreground)]">{a.works_count.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted-foreground)]">cited by</dt>
                <dd className="text-[var(--color-foreground)]">{a.cited_by_count.toLocaleString()}</dd>
              </div>
            </dl>
            {a.notable_works.length > 0 && (
              <ul className="mt-3 text-xs text-[var(--color-muted-foreground)] list-disc pl-4 space-y-0.5">
                {a.notable_works.map((t, j) => <li key={j}>{t}</li>)}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
