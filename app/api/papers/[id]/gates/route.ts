// Phase 4.2 — GET /api/papers/:id/gates
//
// Lists the most recent pending gate for a paper so the cockpit can
// render the Verify card without needing to know the gate id up
// front. Returns 200 with `{ ok, gate | null }` — null when no
// pending gate exists. Auth is enforced via requireUser; ownership
// is enforced via a paper.user_id check.

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../../lib/db";
import { requireUser } from "../../../../../lib/session";
import { getGateById, NotFoundError } from "../../../../../lib/gates";

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
  const owner = await query<{ user_id: string }>(
    `SELECT user_id FROM papers WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (owner.rows.length === 0 || owner.rows[0]!.user_id !== user.sub) {
    return err(403, "forbidden");
  }
  // Most recent pending gate wins. Limit 1 so the cockpit renders a
  // single card; if multiple pending gates exist (shouldn't, but the
  // spec doesn't forbid), the most recent one is shown.
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM gates
      WHERE paper_id = $1 AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1`,
    [id],
  );
  if (rows.length === 0) return NextResponse.json({ ok: true, gate: null });
  try {
    const gate = await getGateById(rows[0]!.id);
    return NextResponse.json({ ok: true, gate });
  } catch (e) {
    if (e instanceof NotFoundError) return NextResponse.json({ ok: true, gate: null });
    throw e;
  }
}
