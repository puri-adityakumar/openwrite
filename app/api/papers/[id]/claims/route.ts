// Phase 3.2 — GET /api/papers/:id/claims
//
// Returns the per-claim rows for a paper. The Claims tab consumes
// this. Ownership-checked against the current user.

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "../../../../../lib/session";
import { query } from "../../../../../lib/db";
import type { Claim } from "../../../../../lib/claims";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await requireUser();
  const { id } = await params;

  const paper = await query<{ user_id: string }>(
    `SELECT user_id FROM papers WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (paper.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "paper not found" }, { status: 404 });
  }
  if (paper.rows[0]!.user_id !== user.sub) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const rows = await query<Claim>(
    `SELECT id, text, evidence, confidence, page, authors
     FROM claims WHERE paper_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  return NextResponse.json({ ok: true, claims: rows.rows });
}
