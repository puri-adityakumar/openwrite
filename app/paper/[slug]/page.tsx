// Phase 2.1 — /paper/[slug]. Guarded. If the paper has a session_id
// (a live run was started via /api/agent/start), render the live
// cockpit which opens an SSE connection to /api/agent/stream. Otherwise
// fall back to the seed render path from Phase 1.3 (no live session =
// use seed_audits).
//
// Plan: "when the paper's session is absent, render from seed_audits".
// Live-session rendering is wired in Phase 2.

import { notFound } from "next/navigation";
import { requireUser } from "../../../lib/session";
import { query } from "../../../lib/db";
import { Cockpit, type SeedEvents } from "../../../components/Cockpit";
import { LiveCockpit } from "../../../components/LiveCockpit";

export const dynamic = "force-dynamic";

type PaperRow = {
  id: string;
  slug: string;
  title: string | null;
  status: string;
  session_id: string | null;
  turn_id: string | null;
};
type SeedRow = { events: SeedEvents };

export default async function PaperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  const paperResult = await query<PaperRow>(
    `SELECT id, slug, title, status, session_id, turn_id FROM papers
     WHERE slug = $1 AND user_id = $2
     LIMIT 1`,
    [slug, user.sub],
  );
  const paper = paperResult.rows[0];
  if (!paper) notFound();

  // Live path: paper has a session — render LiveCockpit which opens the SSE.
  if (paper.session_id && paper.turn_id) {
    const streamUrl = `/api/agent/stream?sessionId=${encodeURIComponent(paper.session_id)}&turnId=${encodeURIComponent(paper.turn_id)}&paperId=${encodeURIComponent(paper.id)}`;
    return (
      <LiveCockpit
        slug={paper.slug}
        title={paper.title ?? paper.slug}
        streamUrl={streamUrl}
      />
    );
  }

  // Seed path: no live session — fall back to the Phase 1.3 renderer.
  const seedResult = await query<SeedRow>(
    `SELECT events FROM seed_audits WHERE paper_id = $1 LIMIT 1`,
    [paper.id],
  );
  const seed = seedResult.rows[0];
  if (!seed) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-semibold">{paper.title ?? paper.slug}</h1>
        <p className="mt-4 text-[var(--muted)]">
          No seed render available for this paper. Start a run from /paper/new to see the live cockpit.
        </p>
      </div>
    );
  }

  return <Cockpit slug={paper.slug} title={paper.title ?? paper.slug} status={paper.status} events={seed.events} />;
}
