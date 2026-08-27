// Phase 1.3 — /dashboard. Guarded by requireUser() (lib/session).
// Shows a greeting, the [+ New Paper] CTA, and a paper card for every
// row in the `papers` table owned by the current user. The seeded
// "Attention Is All You Need" card must be present and link to
// /paper/attention-is-all-you-need.

import Link from "next/link";
import { requireUser } from "../../lib/session";
import { query } from "../../lib/db";

export const dynamic = "force-dynamic";

type PaperRow = {
  id: string;
  slug: string;
  title: string | null;
  mode: string;
  status: string;
  updated_at: string | null;
  created_at: string;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - then) / 1000));
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function DashboardPage() {
  const user = await requireUser();
  const result = await query<PaperRow>(
    `SELECT id, slug, title, mode, status, updated_at, created_at
     FROM papers
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.sub],
  );
  const papers = result.rows;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Hi, {user.email ?? "there"}.</h1>
        <Link
          href="/paper/new"
          className="rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-medium hover:bg-[var(--panel-2)]"
        >
          + New Paper
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {papers.map((p) => (
          <Link
            key={p.id}
            href={`/paper/${p.slug}`}
            className="block rounded border border-[var(--border)] bg-[var(--panel)] p-4 hover:bg-[var(--panel-2)]"
          >
            <div className="text-base font-semibold leading-tight">
              {p.title ?? p.slug}
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-[var(--muted)]">
              <span className="inline-flex items-center gap-1">
                <span className={p.status === "done" ? "text-[var(--good)]" : "text-[var(--muted)]"}>
                  ✓
                </span>
                {p.status}
              </span>
              <span className="capitalize">{p.mode}</span>
              <span>{formatRelative(p.updated_at ?? p.created_at)}</span>
            </div>
          </Link>
        ))}
        {papers.length === 0 && (
          <p className="text-sm text-[var(--muted)] col-span-full">
            No papers yet. <Link href="/paper/new" className="underline">Drop one in</Link>.
          </p>
        )}
      </div>
      <p className="mt-6 text-xs text-[var(--muted)]">
        <Link href="#" className="inline-block rounded-full border border-[var(--border)] px-2 py-1">ⓘ Tour</Link>
      </p>
    </div>
  );
}
