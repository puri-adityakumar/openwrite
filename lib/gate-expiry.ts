// Qodo review #3 — deny-on-expiry resolution.
//
// Expiring a gate row is only half the contract ("treated as deny"):
// the paused TrueForge turn must actually receive the deny approval,
// and the paper must reattach to the resumed turn — otherwise the
// cockpit stays glued to the old paused turn while upstream has moved
// on. This is the server-side half that lib/gates.ts (DB-only) calls
// into from the snapshot route.
//
// Best-effort by design: the gate row is already terminal when we get
// here, so a failed resume must not throw — the cockpit renders the
// expired copy and the user's restart path is Replay.

import { query } from "./db";
import { expireOverdueGates, listJustExpired, EXPIRY_COPY } from "./gates";
import { getTrueForgeClient } from "./trueforge";

export async function resolveExpiredGates(now: Date = new Date()): Promise<number> {
  await expireOverdueGates(now);
  const justExpired = await listJustExpired(now);
  if (justExpired.length === 0) return 0;

  const client = getTrueForgeClient();
  let resumed = 0;
  for (const gate of justExpired) {
    const sessionRes = await query<{ session_id: string | null; turn_id: string | null }>(
      `SELECT session_id, turn_id FROM papers WHERE id = $1 LIMIT 1`,
      [gate.paper_id],
    );
    const paper = sessionRes.rows[0];
    if (!paper?.session_id) continue;
    try {
      const { turnId } = await client.resumeTurnWithApproval({
        sessionId: paper.session_id,
        threadId: gate.thread_id,
        toolCallId: gate.tool_call_id,
        decision: "deny",
        reason: EXPIRY_COPY,
      });
      // Bookkeeping — mirror the approve route: the resumed turn
      // becomes the paper's current turn and the run leaves 'paused'.
      // Guarded on session_id so a replayed paper's old turn id can't
      // clobber the new session's row.
      await query(
        `UPDATE papers SET turn_id = $2, status = 'running', updated_at = now()
          WHERE id = $1 AND session_id = $3`,
        [gate.paper_id, turnId, paper.session_id],
      );
      resumed += 1;
    } catch (e) {
      console.error("[gate-expiry] deny-on-expiry resume failed:", (e as Error).message);
    }
  }
  return resumed;
}
