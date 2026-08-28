// Phase 5.3 — POST /api/agent/replay {paperId}: creates a NEW
// TrueForge session for the same paper (fresh sandbox), flips the
// paper back to running, preserves the previous audit.
// GET /api/agent/replay?paperId=: the freshness proof — the original
// vs replay sandboxIds from the audit rows.
//
// Errors: 400 invalid body · 401 unauthenticated · 404 unknown paper
// (or not the owner) · 409 a run is live.

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../lib/db";
import { requireUser } from "../../../../lib/session";
import { replayPaper, getReplayStatus, ConflictError, NotFoundError } from "../../../../lib/replay";

export { getReplayStatus };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return err(401, "authentication required");
  }

  let body: { paperId?: string };
  try {
    body = (await req.json()) as { paperId?: string };
  } catch {
    return err(400, "invalid JSON body");
  }
  if (!body.paperId || typeof body.paperId !== "string") {
    return err(400, "paperId is required");
  }

  const owner = await query<{ id: string }>(
    `SELECT id FROM papers WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [body.paperId, user.sub],
  );
  if (owner.rows.length === 0) return err(404, "paper not found");

  try {
    const out = await replayPaper(body.paperId);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof ConflictError) return err(409, e.message);
    if (e instanceof NotFoundError) return err(404, e.message);
    throw e;
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return err(401, "authentication required");
  }
  const paperId = new URL(req.url).searchParams.get("paperId");
  if (!paperId) return err(400, "paperId is required");
  const owner = await query<{ id: string }>(
    `SELECT id FROM papers WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [paperId, user.sub],
  );
  if (owner.rows.length === 0) return err(404, "paper not found");
  const status = await getReplayStatus(paperId);
  return NextResponse.json({ ok: true, ...status });
}
