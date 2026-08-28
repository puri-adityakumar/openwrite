// Phase 5.1 — server-side cap enforcement (db-touching half of the
// cap guard; the pure logic lives in lib/cap.ts so client components
// can share it without pulling pg into the browser bundle).

import { query } from "./db";
import { appendAuditEvent } from "./audit";
import { capExceeded, type Cap, type CapUsage } from "./cap";

// Stream-side hard stop: when the usage exceeds the paper's cap, flip
// the run to done + halted with halt_reason 'cap' and write the audit
// row. Idempotent via the NOT halted guard. Returns whether it stopped.
export async function enforceCap(paperId: string, usage: CapUsage): Promise<boolean> {
  const row = await query<{ cap_usd: string | number | null; cap_tokens: number | null; halted: boolean }>(
    `SELECT cap_usd, cap_tokens, halted FROM papers WHERE id = $1 LIMIT 1`,
    [paperId],
  );
  const p = row.rows[0];
  if (!p || p.halted) return false;
  const cap: Cap = {
    capUsd: p.cap_usd == null ? null : Number(p.cap_usd),
    capTokens: p.cap_tokens,
  };
  if (!capExceeded(cap, usage)) return false;
  await query(
    `UPDATE papers SET status = 'done', halted = true, halt_reason = 'cap', updated_at = now()
     WHERE id = $1 AND NOT halted`,
    [paperId],
  );
  await appendAuditEvent(paperId, {
    type: "cap.exceeded",
    payload: {
      totalTokens: usage.totalTokens,
      totalCostInUsd: usage.totalCostInUsd,
      capTokens: cap.capTokens,
      capUsd: cap.capUsd,
    },
  });
  return true;
}
