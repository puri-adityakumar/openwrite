// Phase 5.4 — /paper/:slug/export. Per mockup: the page-count line,
// [ Download review.md ], and the section list. The download generates
// the markdown from the run's stored outputs and stays LOCKED while a
// publish gate is pending or denied (the Review-mode gate shipped in
// Phase 4). The markdown assembly lives in lib/export-md.ts (shared
// with the download route); this page is its preview.

import { notFound } from "next/navigation";
import { requireUser } from "../../../../lib/session";
import { query } from "../../../../lib/db";
import { buildExportInput } from "../../../../lib/export-data";

export const dynamic = "force-dynamic";

type PaperRow = { id: string; slug: string; title: string | null; mode: string };

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

  const { markdown, pageCount, locked } = await buildExportInput(paper);

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="export-page">
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-semibold">Export — {paper.title ?? paper.slug}</h1>
        <a href={`/paper/${paper.slug}`} className="text-sm text-[var(--muted)] underline">
          ◀ Cockpit
        </a>
      </div>
      <p className="mt-2 text-sm text-[var(--muted)]" data-testid="export-page-count">
        Review mode produced {pageCount} pages of markdown.
      </p>

      {/* The download: locked until the Review-mode Publish gate is
          allowed (Phase 4). The seed paper has no publish gate — the
          demo download flows. */}
      <div className="mt-4 flex items-center gap-3">
        {locked ? (
          <span
            className="rounded border border-[var(--bad)] px-3 py-1 text-sm text-[var(--bad)]"
            data-testid="export-locked"
            title="The Publish gate has not allowed this review"
          >
            ⬇ Download locked — allow the Publish gate first
          </span>
        ) : (
          <a
            href={`/paper/${paper.slug}/export/download`}
            data-testid="export-download"
            className="rounded bg-[var(--good)] px-3 py-1 text-sm font-medium text-black"
          >
            ⬇ Download review.md
          </a>
        )}
      </div>

      <h2 className="mt-6 text-sm font-medium text-[var(--muted)]">Sections</h2>
      <ul className="mt-1 list-disc pl-5 text-sm" data-testid="export-sections">
        <li>TL;DR</li>
        <li>Claims ↔ evidence</li>
        <li>Reproduction diff</li>
        <li>Open questions for the author</li>
      </ul>

      <h2 className="mt-6 text-sm font-medium text-[var(--muted)]">Preview</h2>
      <pre className="mt-1 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs font-mono leading-5 overflow-x-auto whitespace-pre-wrap">
        {markdown}
      </pre>
    </div>
  );
}
