// Phase 5.3 — replay. One click re-runs the same paper on a NEW
// TrueForge session (and per the fake/live adapter contract, a fresh
// sandbox). The previous audit is preserved so /paper/:slug/audit
// shows the original run followed by the replay (the ▶ replay started
// row separates them).
//
// Freshness proof (docs/plan/phase-5): the replay session's
// sandbox.created sandboxId must differ from the original run's. The
// stream persists sandbox.created rows as it runs; getReplayStatus
// reads them back so the E2E (and a skeptical orchestrator) can assert
// the diff. Do NOT ship silent staleness — see docs/risks.md.

import { query } from "./db";
import { appendAuditEvent } from "./audit";
import { getTrueForgeClient } from "./trueforge";
import { NotFoundError, ConflictError } from "./gates";

export { NotFoundError, ConflictError };

export async function replayPaper(paperId: string): Promise<{ sessionId: string; turnId: string }> {
  const row = await query<{ status: string; mode: string; source_url: string | null; source_pdf: string | null }>(
    `SELECT status, mode, source_url, source_pdf FROM papers WHERE id = $1 LIMIT 1`,
    [paperId],
  );
  const paper = row.rows[0];
  if (!paper) throw new NotFoundError("paper not found");
  // A live turn owns its session; replaying mid-run would orphan it.
  if (paper.status === "running") throw new ConflictError("a run is live — halt or wait before replaying");

  // P9: the seed never references a live arXiv ID — replay works
  // offline on the stored source (URL for live papers, the fixture
  // PDF path otherwise).
  const source =
    paper.source_url ?? (paper.source_pdf ? `upload:${paper.source_pdf}` : "fixture:demo");

  const client = getTrueForgeClient();
  const { sessionId, turnId } = await client.startSession({
    paperId,
    mode: paper.mode as "learn" | "deep-read" | "review",
    source,
  });

  // The replay becomes the paper's current run. A halted run is
  // un-halted: replay is the documented way to re-run a stopped run.
  await query(
    `UPDATE papers SET session_id = $2, turn_id = $3, status = 'running',
       halted = false, halt_reason = NULL, updated_at = now()
     WHERE id = $1`,
    [paperId, sessionId, turnId],
  );
  await appendAuditEvent(paperId, { type: "replay.started", payload: { sessionId, turnId } });
  return { sessionId, turnId };
}

export type ReplayStatus = {
  fresh: boolean;
  originalSandboxId: string | null;
  replaySandboxId: string | null;
};

// Freshness proof reader: the first sandbox.created row is the
// original run's sandbox, the last one is the replay's. fresh is only
// true when both exist and differ.
export async function getReplayStatus(paperId: string): Promise<ReplayStatus> {
  const rows = await query<{ sandbox: string | null }>(
    `SELECT events->'payload'->>'sandboxId' AS sandbox
     FROM audit
     WHERE paper_id = $1 AND events->>'type' = 'sandbox.created'
     ORDER BY id ASC`,
    [paperId],
  );
  const ids = rows.rows.map((r) => r.sandbox).filter((x): x is string => Boolean(x));
  const originalSandboxId = ids[0] ?? null;
  const replaySandboxId = ids.length > 1 ? ids[ids.length - 1]! : null;
  return {
    fresh:
      originalSandboxId !== null &&
      replaySandboxId !== null &&
      originalSandboxId !== replaySandboxId,
    originalSandboxId,
    replaySandboxId,
  };
}
