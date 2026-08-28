// Phase 5.2 — /paper/:slug/audit. The replayable timeline.
//
// Data source: the live `audit` table when the paper has run rows, the
// seed_audits first-paint payload otherwise. Both map into the same
// AuditRow shape (lib/audit-rows.ts) so the page renders either source
// identically — the Phase 1 parity invariant, proved visually here.
// (`npm run parity` guards the data shape; this page guards the view.)

import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/session";
import { query } from "../../../../lib/db";
import { AuditTimeline } from "../../../../components/audit-timeline";
import { ReplayButton } from "../../../../components/replay-button";
import { buildAuditView } from "../../../../lib/audit-view";

export const dynamic = "force-dynamic";

type PaperRow = { id: string; slug: string; title: string | null };

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

  const view = await buildAuditView(paper.id);

  return (
    <AuditTimeline
      title={paper.title ?? paper.slug}
      rows={view.rows}
      footer={view.footer}
      actions={
        <>
          <ReplayButton paperId={paper.id} />
          <a
            href={`/paper/${paper.slug}/export`}
            data-testid="audit-export-link"
            className="rounded border border-[var(--border)] px-3 py-1 text-sm hover:bg-[var(--panel-2)]"
          >
            Export as markdown
          </a>
          <a href={`/paper/${paper.slug}`} className="text-sm text-[var(--muted)] underline">
            ◀ Cockpit
          </a>
        </>
      }
    />
  );
}
