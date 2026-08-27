// Phase 1.3 — /paper/:slug/audit. Guarded. Renders the audit timeline
// from the seed_audits events (the same JSON the cockpit reads), so the
// 6-screen invariant is satisfied with the seed data. The live audit
// table replaces this in Phase 2.

import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/session";
import { query } from "../../../../lib/db";
import type { SeedEvents } from "../../../../components/Cockpit";

export const dynamic = "force-dynamic";

type PaperRow = { id: string; slug: string; title: string | null };
type SeedRow = { events: SeedEvents };

// Replayable timeline: each event in the cockpit trail becomes a row
// here, so the seeded run is visible end-to-end.
function flattenEvents(events: SeedEvents): Array<{ ts: string; label: string; state: string }> {
  const out: Array<{ ts: string; label: string; state: string }> = [];
  for (const pill of events.trail.pills) {
    out.push({ ts: "—", label: pill.label, state: pill.state });
  }
  for (const line of events.pulse) {
    out.push({ ts: "—", label: line, state: "done" });
  }
  return out;
}

export default async function PaperAuditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;

  const paperResult = await query<PaperRow>(
    `SELECT id, slug, title FROM papers
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          Audit — {paper.title ?? paper.slug}
        </h1>
        <a
          href={`/paper/${paper.slug}`}
          className="text-sm text-[var(--muted)] underline"
        >
          ◀ Cockpit
        </a>
      </div>
      {events ? (
        <pre className="mt-4 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs font-mono leading-5 overflow-x-auto">
          {flattenEvents(events).map((row, i) => (
            <div key={i}>
              {row.ts.padEnd(10)} ▶ {row.label}
            </div>
          ))}
        </pre>
      ) : (
        <p className="mt-4 text-sm text-[var(--muted)]">
          No seed audit available. Live timeline lands in Phase 2.
        </p>
      )}
    </div>
  );
}
