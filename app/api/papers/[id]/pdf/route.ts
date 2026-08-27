// Phase 3.2 — GET /api/papers/:id/pdf
//
// Returns the paper's source PDF (seed fixture or uploaded). The
// Reader's pdfjs-dist fetches this URL to render a page.

import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join, isAbsolute, resolve } from "node:path";
import { requireUser } from "../../../../../lib/session";
import { query } from "../../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaperRow = { user_id: string; source_pdf: string | null };

// Repo root resolves to two levels up from this file: app/api/papers/[id]/pdf/route.ts
const REPO_ROOT = resolve(process.cwd());

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await requireUser();
  const { id } = await params;
  const paper = await query<PaperRow>(
    `SELECT user_id, source_pdf FROM papers WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (paper.rows.length === 0) {
    return NextResponse.json({ ok: false, error: "paper not found" }, { status: 404 });
  }
  if (paper.rows[0]!.user_id !== user.sub) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const path = paper.rows[0]!.source_pdf;
  if (!path) {
    return NextResponse.json({ ok: false, error: "no PDF for this paper" }, { status: 404 });
  }
  // Resolve safely: relative paths are anchored at the repo root; absolute
  // paths are taken as-is. Anything outside the repo is rejected.
  const absolute = isAbsolute(path) ? path : join(REPO_ROOT, path);
  if (!absolute.startsWith(REPO_ROOT)) {
    return NextResponse.json({ ok: false, error: "PDF path outside repo" }, { status: 400 });
  }
  try {
    const buf = await readFile(absolute);
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": "application/pdf", "cache-control": "private, max-age=60" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "PDF not readable" }, { status: 404 });
  }
}
