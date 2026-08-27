// Phase 3.2 — GET /api/papers/:id/pdf
//
// Returns the paper's source PDF (seed fixture or uploaded). The
// Reader's pdfjs-dist fetches this URL to render a page.
//
// Qodo #1: source_pdf is user-controllable (the papers POST route
// accepts it). Restricting to the repo root is not enough — any file
// under the repo (including .env, schema.sql, etc.) was reachable.
// We now restrict to an explicit allowlist of directories:
//   - fixtures/papers/   (seed paper)
//   - data/pdfs/         (uploaded PDFs; lives in .gitignore)
// Absolute paths are still rejected so an attacker cannot point to
// /etc/passwd via the source_pdf column.

import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join, isAbsolute, resolve, sep } from "node:path";
import { requireUser } from "../../../../../lib/session";
import { query } from "../../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaperRow = { user_id: string; source_pdf: string | null };

const REPO_ROOT = resolve(process.cwd());

// Allowlist: relative paths must start with one of these directories.
const ALLOWED_PREFIXES = ["fixtures/papers/", "data/pdfs/"];

function isAllowedPath(absolutePath: string): boolean {
  // Compute the path relative to the repo root using forward slashes
  // (POSIX-style) so the comparison is OS-agnostic.
  const rel = absolutePath.startsWith(REPO_ROOT + sep)
    ? absolutePath.slice(REPO_ROOT.length + 1)
    : absolutePath;
  const relPosix = rel.split(sep).join("/");
  return ALLOWED_PREFIXES.some((prefix) => relPosix === prefix.slice(0, -1) || relPosix.startsWith(prefix));
}

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
  // Qodo #1: reject absolute paths outright. Relative paths are
  // resolved against the repo root, then must fall under the
  // allowlist above.
  if (isAbsolute(path)) {
    return NextResponse.json({ ok: false, error: "absolute PDF paths are not allowed" }, { status: 400 });
  }
  const absolute = join(REPO_ROOT, path);
  if (!absolute.startsWith(REPO_ROOT)) {
    return NextResponse.json({ ok: false, error: "PDF path outside repo" }, { status: 400 });
  }
  if (!isAllowedPath(absolute)) {
    return NextResponse.json({ ok: false, error: "PDF path not in allowlist" }, { status: 400 });
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
