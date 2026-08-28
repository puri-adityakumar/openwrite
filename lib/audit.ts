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

// Phase 5 — writer for app-generated audit rows (halt pause/stop, cap
// exceeded, gate decisions, replay). Same jsonb shape as a LiveEvent so
// the audit page renders upstream and app rows uniformly. A fresh
// negative seq keeps these below the reducer's seq cursor — app rows
// are metadata, never replayed as live events.
export async function appendAuditEvent(
  paperId: string,
  event: { type: string; payload?: Record<string, unknown> },
): Promise<void> {
  const row = {
    id: `app_${event.type}_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    type: event.type,
    payload: event.payload ?? {},
    seq: 0,
  };
  try {
    await query(
      `INSERT INTO audit (paper_id, events) VALUES ($1, $2::jsonb)`,
      [paperId, JSON.stringify(row)],
    );
  } catch (e) {
    throw new AuditWriteError(e);
  }
}
