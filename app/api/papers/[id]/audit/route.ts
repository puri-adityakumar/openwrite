// JSON audit rows for the cockpit's in-chat Audit panel.
//
// Reuses buildAuditView so live and seed papers render the same shape
// (AuditRow: { ts, icon, message }). Owned by the current user only.

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../../lib/db";
import { requireUser } from "../../../../../lib/session";
import { buildAuditView } from "../../../../../lib/audit-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "authentication required" }, { status: 401 });
  }
  const { id } = await params;
  const owner = await query<{ id: string }>(
    `SELECT id FROM papers WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [id, user.sub],
  );
  if (owner.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "paper not found" }, { status: 404 });
  }
  const view = await buildAuditView(id);
  return NextResponse.json({ ok: true, ...view });
}
