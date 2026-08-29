// Phase 3 — /paper/[slug]. Guarded. Splits into the live path
// (paper has session_id + turn_id) and the seed path (no session,
// render from seed_audits + seed claims). Both paths hand off to
// CockpitClient.

import { notFound } from "next/navigation";
import { requireUser } from "../../../lib/session";
import { query } from "../../../lib/db";
import { CockpitClient } from "../../../components/CockpitClient";
import { deriveTrail, initialState } from "../../../lib/event-reducer";
import { LiveCockpit } from "../../../components/LiveCockpit";
import type { SeedEvents } from "../../../components/Cockpit";

export const dynamic = "force-dynamic";

type PaperRow = {
  id: string;
  slug: string;
  title: string | null;
  status: string;
  session_id: string | null;
  turn_id: string | null;
  source_pdf: string | null;
  halted: boolean;
  cap_usd: string | null;
  cap_tokens: number | null;
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
    `SELECT id, slug, title, status, session_id, turn_id, source_pdf, halted, cap_usd, cap_tokens
     FROM papers WHERE slug = $1 AND user_id = $2 LIMIT 1`,
    [slug, user.sub],
  );
  const paper = paperResult.rows[0];
  if (!paper) notFound();
  const capUsd = paper.cap_usd == null ? null : Number(paper.cap_usd);

  // Live path: paper has a session — render the live SSE cockpit.
  if (paper.session_id && paper.turn_id) {
    const streamUrl = `/api/agent/stream?sessionId=${encodeURIComponent(paper.session_id)}&turnId=${encodeURIComponent(paper.turn_id)}&paperId=${encodeURIComponent(paper.id)}`;
    return (
      <LiveCockpit
        slug={paper.slug}
        title={paper.title ?? paper.slug}
        paperId={paper.id}
        streamUrl={streamUrl}
        pdfUrl={paper.source_pdf ? `/api/papers/${paper.id}/pdf` : null}
        halted={paper.halted}
        capUsd={capUsd}
        capTokens={paper.cap_tokens}
      />
    );
  }

  // Seed path.
  const seedResult = await query<SeedRow>(
    `SELECT events FROM seed_audits WHERE paper_id = $1 LIMIT 1`,
    [paper.id],
  );
  const seed = seedResult.rows[0];
  if (!seed) {
    return (
      <div className="page-wide py-10">
        <h1 className="text-2xl">{paper.title ?? paper.slug}</h1>
        <p className="mt-4 text-[var(--color-muted-foreground)]">
          No seed render available for this paper. Start a run from{" "}
          <a href="/paper/new">/paper/new</a> to see the live cockpit.
        </p>
      </div>
    );
  }

  const initial = initialState();
  const pills = deriveTrail(initial);
  // The seed paper's Pulse lines live in seed_audits.events.pulse; we
  // surface them so the first paint looks the same as the old
  // (pre-Tabs) cockpit. The live path replaces them with real SSE events.
  const liveState = {
    ...initial,
    status: "done" as const,
    pulse: seed.events.pulse,
  };
  // Mark every Trail pill as done for the seed render — the run is complete.
  const donePills = pills.map((p) => ({ ...p, state: "done" as const }));
  return (
    <CockpitClient
      slug={paper.slug}
      title={paper.title ?? paper.slug}
      paperId={paper.id}
      pills={donePills}
      coverage={seed.events.coverage.pages}
      liveState={liveState}
      summary={seed.events.summary}
      pdfUrl={paper.source_pdf ? `/api/papers/${paper.id}/pdf` : null}
      halted={paper.halted}
      capUsd={capUsd}
      capTokens={paper.cap_tokens}
    />
  );
}
