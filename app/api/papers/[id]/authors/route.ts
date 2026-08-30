// Phase 3.1 — GET /api/papers/:id/authors
//
// Returns the OpenAlex profiles for the paper's authors. The author
// names come from the paper's metadata (Phase 4 will populate this
// from the parsed paper; today the seed path uses the seed's
// "8 authors" placeholder list).
//
// Each lookup is cached in-process for the duration of the Node
// process so back-to-back renders don't hammer OpenAlex.

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "../../../../../lib/session";
import { query } from "../../../../../lib/db";
import { lookupAuthor, type OpenAlexAuthor } from "../../../../../lib/openalex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cache = new Map<string, OpenAlexAuthor | null>();

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-");
}

type PaperRow = { id: string; user_id: string; source_url: string | null; source_pdf: string | null };
type ClaimRow = { authors: string[] | null };

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

  const paper = await query<PaperRow>(
    `SELECT id, user_id, source_url, source_pdf FROM papers WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (paper.rows.length === 0) return NextResponse.json({ ok: false, error: "paper not found" }, { status: 404 });
  if (paper.rows[0]!.user_id !== user.sub) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Qodo #6: collect authors from EVERY claim (not just one) so the
  // list is complete and stable. Postgres's UNNEST flattens the
  // text[] columns into one name per row, which we then dedupe
  // (preserving the order of first appearance).
  const claimAuthors = await query<{ author: string }>(
    `SELECT DISTINCT UNNEST(authors) AS author FROM claims
     WHERE paper_id = $1 AND authors IS NOT NULL
     ORDER BY author`,
    [id],
  );
  const names = claimAuthors.rows.map((r) => r.author);
  if (names.length === 0) {
    return NextResponse.json({ ok: true, authors: [], note: "no authors yet" });
  }

  const authors: Array<OpenAlexAuthor | { name: string; error: string }> = [];
  for (const name of names) {
    const key = slugify(name);
    let entry = cache.get(key);
    if (entry === undefined) {
      entry = await lookupAuthor(name);
      cache.set(key, entry);
    }
    if (entry) authors.push(entry);
    else authors.push({ name, error: "not found" });
  }
  return NextResponse.json({ ok: true, authors });
}
