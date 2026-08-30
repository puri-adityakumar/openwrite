// Dashboard — "your runs" surface. Server component; reads papers from
// Postgres and renders the grid. The waiting-on-you accent (indigo bar +
// soft wash) marks runs paused at Verify — the only cards that need a
// human — and those sort to the front. The pipeline track on each card
// shows where the run is without decoding a status word.

import Link from "next/link";
import { requireUser } from "../../lib/session";
import { query } from "../../lib/db";
import { Pill } from "../../components/Pill";
import { Reveal } from "../../components/landing/Reveal";
import { LogoMark } from "../../components/landing/Logo";
import { DashFilterBridge } from "../../components/dash-filter-bridge";

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

// Trail stages, front to back. A card's track fills up to its current
// stage; Verify is the only stage that pulses (waiting on you).
const STAGES = ["source", "parse", "extract", "verify", "done"] as const;
type Stage = (typeof STAGES)[number];

const WAITING = new Set(["verify"]);

type Filter = "all" | "waiting" | "done" | "failed";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "waiting", label: "Waiting on you" },
  { id: "done", label: "Done" },
  { id: "failed", label: "Failed" },
];

// Filter state lives in the URL hash (#waiting) so a chip click is a
// client-side hash change — no server round-trip, no 404. Server
// components can't read the hash, so the client passes it back via
// searchParams on a self-navigation (next/navigation preserves it).
function parseFilter(raw: string | null): Filter {
  return FILTERS.some((f) => f.id === raw) ? (raw as Filter) : "all";
}

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

function stageIndex(status: string): number {
  const i = STAGES.indexOf(status as Stage);
  return i === -1 ? 0 : i;
}

// Human copy for each card — the pill label reads as speech, not snake_case.
const STATUS_COPY: Record<string, string> = {
  source: "Sourcing",
  parse: "Parsing",
  extracting: "Extracting",
  verify: "Waiting on you",
  done: "Done",
  failed: "Failed",
  denied: "Denied",
};

// The event line tells what happened, not just where the run is.
const EVENT_COPY: Record<string, string> = {
  source: "Source collected",
  parse: "Parsing finished",
  extracting: "Extracting",
  verify: "Approval requested",
  done: "Run complete",
  failed: "Run failed",
  denied: "Denied",
};

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

function matchesFilter(p: PaperRow, f: Filter): boolean {
  switch (f) {
    case "all": return true;
    case "waiting": return WAITING.has(p.status);
    case "done": return p.status === "done";
    case "failed": return p.status === "failed" || p.status === "denied";
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const user = await requireUser();
  const result = await query<PaperRow>(
    `SELECT id, slug, title, mode, status, updated_at, created_at
     FROM papers
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [user.sub],
  );
  const papers = result.rows;

  // Server can't see the URL hash, so the client echoes it as ?f= on a
  // self-navigation; both sources converge on the same parseFilter.
  const active = parseFilter((await searchParams).f ?? null);

  // Waiting-on-you runs first; the rest keep recency order.
  const sorted = [...papers].sort((a, b) => {
    const aw = WAITING.has(a.status) ? 0 : 1;
    const bw = WAITING.has(b.status) ? 0 : 1;
    if (aw !== bw) return aw - bw;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const filtered = sorted.filter((p) => matchesFilter(p, active));
  const waitingCount = papers.filter((p) => WAITING.has(p.status)).length;

  const eyebrow = "Runs";

  return (
    <div className="page-wide py-10 md:py-14 animate-fade-in">
      <DashFilterBridge />
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p
            className="text-[0.6875rem] font-heading font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]"
          >
            {eyebrow}
          </p>
          <h1
            className="mt-1"
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              fontSize: "clamp(2rem, 4vw, 2.75rem)",
              lineHeight: 1.05,
              color: "var(--color-foreground)",
            }}
          >
            Your runs
          </h1>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            {papers.length === 0
              ? "No runs yet. Drop your first paper in."
              : `${papers.length} ${papers.length === 1 ? "run" : "runs"}`}
          </p>
          {waitingCount > 0 && (
            <p
              className="mt-2 text-sm font-medium"
              style={{ color: "var(--accent-indigo)" }}
            >
              {waitingCount} waiting on you
            </p>
          )}
        </div>
        <Link href="/paper/new" className="btn btn-primary">
          + New paper
        </Link>
      </div>

      {papers.length > 0 && (
        <>
          <div className="mt-6 flex items-center gap-2 flex-wrap" role="group" aria-label="Filter runs">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={`/dashboard#${f.id}`}
                scroll={false}
                aria-current={active === f.id ? "page" : undefined}
                className={active === f.id ? "dash-filter dash-filter-active" : "dash-filter"}
              >
                {f.label}
                {f.id === "waiting" && waitingCount > 0 && (
                  <span className="dash-filter-count">{waitingCount}</span>
                )}
              </Link>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p, i) => {
              const waiting = WAITING.has(p.status);
              const idx = stageIndex(p.status);
              const relative = formatRelative(p.updated_at ?? p.created_at);
              const event = EVENT_COPY[p.status] ?? p.status;
              return (
                <Reveal key={p.id} as="article" delay={Math.min(i, 8) * 50}>
                  <Link
                    href={`/paper/${p.slug}`}
                    className={
                      waiting
                        ? "card dash-card dash-card-waiting no-underline"
                        : "card dash-card no-underline"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base leading-tight line-clamp-2 min-w-0 break-all">
                        {p.title ?? p.slug}
                      </h3>
                      <Pill tone={statusTone(p.status)} className="shrink-0">
                        {STATUS_COPY[p.status] ?? p.status}
                      </Pill>
                    </div>

                    <div className="dash-track mt-4" aria-label={`Stage ${idx + 1} of 5`}>
                      {STAGES.map((s, j) => (
                        <span
                          key={s}
                          aria-hidden="true"
                          className={
                            j < idx
                              ? "dash-dot dash-dot-done"
                              : j === idx
                                ? waiting
                                  ? "dash-dot dash-dot-verify"
                                  : "dash-dot dash-dot-cur"
                                : "dash-dot"
                          }
                        />
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
                      <span className="capitalize font-mono">{p.mode}</span>
                      <span aria-hidden="true">·</span>
                      <span>{event} · {relative}</span>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </>
      )}

      {papers.length === 0 && (
        <div className="mt-10 card text-center py-10 empty-hero" data-testid="dashboard-empty">
          <span className="empty-hero-mark" aria-hidden="true">
            <LogoMark size={22} />
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
              <div className="empty-step-track" aria-hidden="true">
                <span className="dash-dot dash-dot-done" />
                <span className="dash-dot" />
                <span className="dash-dot" />
                <span className="dash-dot" />
                <span className="dash-dot" />
              </div>
            </div>
            <div className="empty-step" data-testid="dashboard-empty-step-audit">
              <span className="empty-step-label">2 · Audit</span>
              <div className="empty-step-title">Every event is logged</div>
              <p className="empty-step-body">
                Source, parse, extract, score — each step is recorded with the
                timestamp, the role, and the input that produced it.
              </p>
              <div className="empty-step-track" aria-hidden="true">
                <span className="dash-dot dash-dot-done" />
                <span className="dash-dot dash-dot-done" />
                <span className="dash-dot dash-dot-done" />
                <span className="dash-dot" />
                <span className="dash-dot" />
              </div>
            </div>
            <div className="empty-step" data-testid="dashboard-empty-step-verify">
              <span className="empty-step-label">3 · Verify</span>
              <div className="empty-step-title">Human approves first</div>
              <p className="empty-step-body">
                Before any tool runs, the agent pauses for a typed owner match
                and a 3-second hold. Deny at any time.
              </p>
              <div className="empty-step-track" aria-hidden="true">
                <span className="dash-dot dash-dot-done" />
                <span className="dash-dot dash-dot-done" />
                <span className="dash-dot dash-dot-done" />
                <span className="dash-dot dash-dot-verify" />
                <span className="dash-dot" />
              </div>
            </div>
          </div>
          <div className="mt-7">
            <Link href="/paper/new" className="btn btn-primary" data-testid="dashboard-empty-cta">
              Drop your first paper
            </Link>
            <p className="mt-4 text-xs font-mono text-[var(--color-muted-foreground)]">
              Demo: <span className="font-semibold text-[var(--color-foreground)]">demo@local</span> / demo1234
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
