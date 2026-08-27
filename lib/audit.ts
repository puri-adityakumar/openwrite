// Phase 2.1 — audit row writer.
//
// Per Phase 2.1#5: every SSE event that flows through the reducer
// must be persisted to the `audit` table (events jsonb). One row per
// event keeps the audit timeline trivial to render (Phase 5) and
// makes the day-one sandbox.created probe a simple SELECT.
//
// Qodo #9: failures are now surfaced as AuditWriteError so the SSE
// route can emit a turn.error frame and the caller can see that
// replay/audit data is incomplete. Silent swallowing was hiding
// persistent DB issues.

import { query } from "./db";
import type { LiveEvent } from "./event-reducer";

export class AuditWriteError extends Error {
  constructor(public readonly cause: unknown) {
    super(`audit write failed: ${(cause as Error)?.message ?? String(cause)}`);
    this.name = "AuditWriteError";
  }
}

export async function appendAudit(paperId: string, event: LiveEvent): Promise<void> {
  try {
    await query(
      `INSERT INTO audit (paper_id, events) VALUES ($1, $2::jsonb)`,
      [paperId, JSON.stringify(event)],
    );
  } catch (e) {
    throw new AuditWriteError(e);
  }
}
