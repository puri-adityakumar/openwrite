// Phase 5.4 — GET /paper/:slug/export/download. Streams review.md as
// an attachment. Locked (publish gate pending/denied) returns 403 with
// the same copy the page shows.

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../../lib/db";
import { requireUser } from "../../../../../lib/session";
import { buildExportInput } from "../../../../../lib/export-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse | Response> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return NextResponse.json({ ok: false, error: "authentication required" }, { status: 401 });
  }
  const { slug } = await params;
  const paperResult = await query<{ id: string; slug: string; title: string | null; mode: string }>(
    `SELECT id, slug, title, mode FROM papers WHERE slug = $1 AND user_id = $2 LIMIT 1`,
    [slug, user.sub],
  );
  const paper = paperResult.rows[0];
  if (!paper) {
    return NextResponse.json({ ok: false, error: "paper not found" }, { status: 404 });
  }

  const { markdown, locked } = await buildExportInput(paper);
  if (locked) {
    return NextResponse.json(
      { ok: false, error: "Download locked — allow the Publish gate first" },
      { status: 403 },
    );
  }

  return new Response(markdown, {
    status: 200,
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="review.md"`,
    },
  });
}
