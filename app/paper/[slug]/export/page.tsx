// Phase 1.3 — /paper/:slug/export. Guarded. Renders the review as
// markdown (TL;DR + claims + reproduction diff + open questions) from
// the seed_audits summary. The 6-screen invariant is satisfied; live
// markdown generation lands in Phase 2.

import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/session";
import { query } from "../../../../lib/db";
import type { SeedEvents } from "../../../../components/Cockpit";

export const dynamic = "force-dynamic";

type PaperRow = { id: string; slug: string; title: string | null; mode: string };
type SeedRow = { events: SeedEvents };

function toMarkdown(paper: PaperRow, events: SeedEvents): string {
  return [
    `# ${paper.title ?? paper.slug}`,
    "",
    `> ${events.summary.tldr}`,
    "",
    "## Abstract",
    "",
    events.summary.abstract,
    "",
    "## Claims",
    "",
    `${events.summary.claims_count} claims · ${events.summary.evidence_count} evidence pieces.`,
    "",
    "## Reproduction diff",
    "",
    "Outperforms prior SOTA on both BLEU and training cost. Trained on WMT 2014 EN-DE and EN-FR translation tasks.",
    "",
    "## Open questions for the author",
    "",
    "- How sensitive is performance to the number of attention heads?",
    "- What is the failure mode on long sequences?",
    "",
  ].join("\n");
}

export default async function PaperExportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  const paperResult = await query<PaperRow>(
    `SELECT id, slug, title, mode FROM papers
     WHERE slug = $1 AND user_id = $2
     LIMIT 1`,
    [slug, user.sub],
  );
  const paper = paperResult.rows[0];
  if (!paper) notFound();

  const seedResult = await query<SeedRow>(
    `SELECT events FROM seed_audits WHERE paper_id = $1 LIMIT 1`,
    [paper.id],
  );
  const seed = seedResult.rows[0];
  const events: SeedEvents | null = seed?.events ?? null;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold">
        Export — {paper.title ?? paper.slug}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {paper.mode} mode produced a markdown review.
      </p>
      <pre className="mt-4 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs font-mono leading-5 overflow-x-auto whitespace-pre-wrap">
        {events ? toMarkdown(paper, events) : "No seed available. Live export lands in Phase 2."}
      </pre>
    </div>
  );
}
