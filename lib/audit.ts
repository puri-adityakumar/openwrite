// Phase 2.1 — audit row writer.
//
// Per Phase 2.1#5: every SSE event that flows through the reducer
// must be persisted to the `audit` table (events jsonb). One row per
// event keeps the audit timeline trivial to render (Phase 5) and
// makes the day-one sandbox.created probe a simple SELECT.

import { query } from "./db";
import type { LiveEvent } from "./event-reducer";

export async function appendAudit(paperId: string, event: LiveEvent): Promise<void> {
  await query(
    `INSERT INTO audit (paper_id, events) VALUES ($1, $2::jsonb)`,
    [paperId, JSON.stringify(event)],
  );
}
