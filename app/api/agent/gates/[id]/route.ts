// Phase 4.1 — GET /api/agent/gates/[id]
//
// Returns the current state of a single gate (status + seconds-until-
// expiry) for the cockpit's countdown widget. The route also opportun-
// istically runs expireOverdueGates() so the UI sees a fresh status
// without needing a separate cron.
//
// Returns 401 on unauthenticated, 403 on a paper the caller doesn't
// own, 404 on a missing gate id, 200 with the snapshot otherwise.

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../../lib/db";
import { requireUser } from "../../../../../lib/session";
import {
  expireOverdueGates,
  getGateById,
  listJustExpired,
  secondsUntilExpiry,
  EXPIRY_COPY,
  NotFoundError,
} from "../../../../../lib/gates";
import { getTrueForgeClient } from "../../../../../lib/trueforge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return err(401, "authentication required");
  }
  const { id } = await params;
  // Expire any overdue gates first so the snapshot reflects truth.
  const now = new Date();
  await expireOverdueGates(now);
  // Qodo #3 — for any gate that just flipped to 'expired', send a
  // deny approval to TrueForge so the agent unpauses. We do this on
  // the snapshot route (called by the cockpit's countdown poll) so
  // the next reload sees a 'running' status. Errors are swallowed
  // (best-effort) — the gate row is already terminal, the cockpit
  // will surface the expired copy and offer a restart path.
  const justExpired = await listJustExpired(now);
  if (justExpired.length > 0) {
    const client = getTrueForgeClient();
    for (const g of justExpired) {
      const sessionRes = await query<{ session_id: string | null }>(
        `SELECT session_id FROM papers WHERE id = $1 LIMIT 1`,
        [g.paper_id],
      );
      const sessionId = sessionRes.rows[0]?.session_id;
      if (!sessionId) continue;
      try {
        await client.resumeTurnWithApproval({
          sessionId,
          threadId: g.thread_id,
          toolCallId: g.tool_call_id,
          decision: "deny",
          reason: EXPIRY_COPY,
        });
      } catch (e) {
        // Best-effort; the row is already terminal.
        console.error("[gate-snapshot] deny-on-expiry resume failed:", (e as Error).message);
      }
    }
  }
  let gate;
  try {
    gate = await getGateById(id);
  } catch (e) {
    if (e instanceof NotFoundError) return err(404, "gate not found");
    throw e;
  }
  const owner = await query<{ user_id: string }>(
    `SELECT user_id FROM papers WHERE id = $1 LIMIT 1`,
    [gate.paper_id],
  );
  if (owner.rows.length === 0 || owner.rows[0]!.user_id !== user.sub) {
    return err(403, "forbidden");
  }
  return NextResponse.json({
    ok: true,
    gate,
    secondsRemaining: secondsUntilExpiry(gate),
  });
}
