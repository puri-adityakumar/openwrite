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
import { Pill } from "../../../../components/Pill";

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
    <div className="page py-10" data-testid="export-page" style={{ maxWidth: "48rem" }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="rcp-eyebrow">Export</span>
          <h1 className="mt-3 text-2xl md:text-3xl">{paper.title ?? paper.slug}</h1>
        </div>
        <a
          href={`/paper/${paper.slug}`}
          className="text-xs text-[var(--color-muted-foreground)] no-underline hover:underline"
        >
          ← Cockpit
        </a>
      </div>
      <p className="mt-3 text-sm" data-testid="export-page-count">
        Review mode produced {pageCount} {pageCount === 1 ? "page" : "pages"} of markdown.
      </p>

      <div className="mt-6 flex items-center gap-3 flex-wrap">
        {locked ? (
          <>
            <Pill
              tone="bad"
              data-testid="export-locked"
              style={{ borderColor: "var(--color-destructive)", color: "var(--color-destructive)" }}
              title="The Publish gate has not allowed this review"
            >
              Download locked — allow the Publish gate first
            </Pill>
            <a
              href={`/paper/${paper.slug}`}
              className="text-sm text-[var(--color-muted-foreground)] no-underline hover:underline"
            >
              Return to the paper and complete the Verify gate to unlock →
            </a>
          </>
        ) : (
          <a
            href={`/paper/${paper.slug}/export/download`}
            data-testid="export-download"
            className="btn btn-primary"
          >
            Download review.md
          </a>
        )}
      </div>

      <section className="mt-8">
        <span className="rcp-eyebrow">Sections</span>
        <ul className="mt-3 list-disc pl-5 text-sm text-[var(--color-foreground)]" data-testid="export-sections">
          <li>TL;DR</li>
          <li>Claims ↔ evidence</li>
          <li>Reproduction diff</li>
          <li>Open questions for the author</li>
        </ul>
      </section>

      <section className="mt-8">
        <span className="rcp-eyebrow">Preview</span>
        <pre
          className="mt-3 rounded border border-[var(--color-border)] bg-[var(--color-secondary)] p-3 text-xs font-mono leading-5 overflow-x-auto whitespace-pre-wrap text-[var(--color-foreground)]"
        >
          {markdown}
        </pre>
      </section>
    </div>
  );
}
