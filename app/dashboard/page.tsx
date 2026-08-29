import Link from "next/link";
import { requireUser } from "../../lib/session";
import { query } from "../../lib/db";
import { Tour } from "../../components/tour";
import { Pill } from "../../components/Pill";

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

function statusTone(status: string): "good" | "warn" | "bad" | "idle" {
  switch (status) {
    case "done": return "good";
    case "verify":
    case "extracting": return "warn";
    case "denied":
    case "failed": return "bad";
    default: return "idle";
  }
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
    <div className="page-wide py-10 md:py-14 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <span className="rcp-eyebrow">Your runs</span>
          <h1 className="mt-3 text-3xl md:text-4xl">Papers</h1>
          <p className="mt-2 text-sm">
            {papers.length === 0
              ? "No runs yet. Drop your first paper in."
              : `${papers.length} ${papers.length === 1 ? "run" : "runs"} · signed in as ${user.email ?? "you"}`}
          </p>
        </div>
        <Link href="/paper/new" className="btn btn-primary">
          + New paper
        </Link>
      </div>

      {papers.length > 0 && (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {papers.map((p) => (
            <Link key={p.id} href={`/paper/${p.slug}`} className="card no-underline hover:border-[var(--color-foreground)] transition-colors">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base leading-tight">
                  {p.title ?? p.slug}
                </h3>
                <Pill tone={statusTone(p.status)} className="shrink-0">
                  {p.status}
                </Pill>
              </div>
              <div className="mt-4 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
                <span className="capitalize font-mono">{p.mode}</span>
                <span aria-hidden="true">·</span>
                <span>{formatRelative(p.updated_at ?? p.created_at)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {papers.length === 0 && (
        <div className="mt-10 card text-center py-10 empty-hero" data-testid="dashboard-empty">
          <span className="empty-hero-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2"  y="3"  width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2"  y="9"  width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2"  y="15" width="18" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </span>
          <h2 className="text-2xl md:text-3xl">
            Read papers with an agent that stops
            <br className="hidden md:inline" /> before doing anything irreversible.
          </h2>
          <p className="mt-3 text-sm">
            Three small checkpoints turn a paper PDF into a clean, citable summary —
            with you holding the only key that ever runs a tool.
          </p>
          <div className="empty-pipeline" data-testid="dashboard-empty-pipeline">
            <div className="empty-step" data-testid="dashboard-empty-step-source">
              <span className="empty-step-label">1 · Source</span>
              <div className="empty-step-title">Paste an arXiv URL</div>
              <p className="empty-step-body">
                Drop a link and we fetch the PDF, the source bundle, and a pinned
                commit — never the live main branch.
              </p>
            </div>
            <div className="empty-step" data-testid="dashboard-empty-step-audit">
              <span className="empty-step-label">2 · Audit</span>
              <div className="empty-step-title">Every event is logged</div>
              <p className="empty-step-body">
                Source, parse, extract, score — each step is recorded with the
                timestamp, the role, and the input that produced it.
              </p>
            </div>
            <div className="empty-step" data-testid="dashboard-empty-step-verify">
              <span className="empty-step-label">3 · Verify</span>
              <div className="empty-step-title">Human approves first</div>
              <p className="empty-step-body">
                Before any tool runs, the agent pauses for a typed owner match
                and a 3-second hold. Deny at any time.
              </p>
            </div>
          </div>
          <div className="mt-7">
            <Link href="/paper/new" className="btn btn-primary" data-testid="dashboard-empty-cta">
              Drop your first paper
            </Link>
          </div>
        </div>
      )}

      <p className="mt-10 text-xs text-[var(--color-muted-foreground)]">
        Press <Pill>How it works</Pill> for a 7-slide walkthrough.
      </p>
      <Tour />
    </div>
  );
}
