// Phase 5.4 — export data assembly (server side). Reads the paper's
// stored outputs: the seed first-paint summary, the claims table, and
// the publish-gate payload (the Δ source). Feeds both the export page
// and the download route.

import { query } from "./db";
import { assembleMarkdown, exportLocked } from "./export-md";
import type { SeedEvents } from "../components/Cockpit";

type SeedRow = { events: SeedEvents };
type ClaimRow = { text: string; evidence: string | null; page: number | null };
type GateRow = { kind: string; status: string; payload: Record<string, unknown> | null };

export type PaperForExport = { id: string; slug: string; title: string | null; mode: string };

export async function buildExportInput(paper: PaperForExport): Promise<{
  markdown: string;
  pageCount: number;
  locked: boolean;
}> {
  const [seedResult, claimsResult, gatesResult] = await Promise.all([
    query<SeedRow>(`SELECT events FROM seed_audits WHERE paper_id = $1 LIMIT 1`, [paper.id]),
    query<ClaimRow>(
      `SELECT text, evidence, page FROM claims WHERE paper_id = $1 ORDER BY created_at ASC`,
      [paper.id],
    ),
    query<GateRow>(`SELECT kind, status, payload FROM gates WHERE paper_id = $1`, [paper.id]),
  ]);
  const seed = seedResult.rows[0]?.events ?? null;
  const pageCount = seed?.coverage?.pages?.length ?? 0;
  const claims = claimsResult.rows.map((c) => ({
    text: c.text,
    evidence: c.evidence,
    page: c.page,
  }));

  // The publish Δ comes from the publish gate payload when one exists.
  const publishGate = gatesResult.rows.find((g) => g.kind === "publish");
  const payload = (publishGate?.payload ?? {}) as Record<string, unknown>;
  const beforeClaimed = Number(payload.beforeClaimed ?? payload.claimedValue);
  const afterReproduced = Number(payload.afterReproduced ?? payload.reproducedValue);
  const publish =
    Number.isFinite(beforeClaimed) && Number.isFinite(afterReproduced)
      ? { beforeClaimed, afterReproduced }
      : null;

  const markdown = assembleMarkdown({
    title: paper.title ?? paper.slug,
    pageCount,
    tldr: seed?.summary?.tldr ?? null,
    claims,
    publish,
    openQuestions:
      paper.mode === "review"
        ? [
            "How sensitive is performance to the number of attention heads?",
            "What is the failure mode on long sequences?",
          ]
        : [],
  });
  return { markdown, pageCount, locked: exportLocked(gatesResult.rows) };
}
