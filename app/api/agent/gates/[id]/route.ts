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
  getGateById,
  secondsUntilExpiry,
  NotFoundError,
} from "../../../../../lib/gates";
import { resolveExpiredGates } from "../../../../../lib/gate-expiry";

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
  // Expire any overdue gates and resolve them upstream: each just-
  // expired gate's TrueForge turn gets the deny approval and the paper
  // reattaches to the resumed turn (lib/gate-expiry.ts). Best-effort.
  await resolveExpiredGates(new Date());
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
