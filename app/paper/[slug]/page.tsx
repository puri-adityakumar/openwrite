// Phase 1.3 — /paper/[slug]. Guarded. For the seeded paper (and any
// other paper that has a row in `seed_audits`), renders the four
// cockpit surfaces — Trail, Coverage, Summary, Pulse — from the
// `events` JSON. Live-session rendering is not wired in this phase
// (listTurnEvents is not a list endpoint per the plan; that lands in
// Phase 2 alongside the agent stream).

import { notFound } from "next/navigation";
import { requireUser } from "../../../lib/session";
import { query } from "../../../lib/db";
import { Cockpit, type SeedEvents } from "../../../components/Cockpit";

export const dynamic = "force-dynamic";

type PaperRow = { id: string; slug: string; title: string | null; status: string };
type SeedRow = { events: SeedEvents };

export default async function PaperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  const paperResult = await query<PaperRow>(
    `SELECT id, slug, title, status FROM papers
     WHERE slug = $1 AND user_id = $2
     LIMIT 1`,
    [slug, user.sub],
  );
  const paper = paperResult.rows[0];
  if (!paper) notFound();

  // Plan: "when the paper's session is absent, render from seed_audits".
  // For Phase 1.3 the seed IS the only render path; the live session path
  // ships in Phase 2. We look up seed_audits for this paper_id and render
  // the four surfaces from that JSON.
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
          No seed render available for this paper. Live cockpit lands in Phase 2.
        </p>
      </div>
    );
  }

  return <Cockpit slug={paper.slug} title={paper.title ?? paper.slug} status={paper.status} events={seed.events} />;
}
