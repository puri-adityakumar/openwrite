// Phase 2.1 — POST /api/papers creates a new paper row owned by the
// current user. GET lists the user's papers. The 6-screens/9-routes
// invariant names this endpoint explicitly in docs/architecture.md.

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../lib/db";
import { requireUser } from "../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  source?: string;
  sourceUrl?: string;
  sourcePdf?: string;
  title?: string;
  mode?: "learn" | "deep-read" | "review";
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^arxiv\.org\//, "")
    .replace(/^abs\//, "")
    .replace(/\.pdf$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "paper";
}

function err(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await requireUser();
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return err(400, "invalid JSON body");
  }
  if (!body.mode || !["learn", "deep-read", "review"].includes(body.mode)) {
    return err(400, "mode must be learn|deep-read|review");
  }
  if (!body.source && !body.sourceUrl && !body.sourcePdf) {
    return err(400, "source, sourceUrl, or sourcePdf is required");
  }
  const source = body.source ?? "";
  const sourceUrl = body.sourceUrl ?? (source.startsWith("http") ? source : null);
  const title = body.title ?? null;
  // The slug is unique per (sourceUrl|fixture). For Phase 2 we generate a
  // timestamp suffix so successive starts of the same fixture don't collide.
  const baseSlug = slugify(sourceUrl ?? body.sourcePdf ?? "paper");
  const slug = `${baseSlug}-${Date.now().toString(36)}`;

  const inserted = await query<{ id: string }>(
    `INSERT INTO papers (user_id, slug, title, source_url, mode, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     RETURNING id`,
    [user.sub, slug, title, sourceUrl, body.mode],
  );
  const paperId = inserted.rows[0]!.id;
  return NextResponse.json({ ok: true, paperId, slug });
}

export async function GET(): Promise<NextResponse> {
  const user = await requireUser();
  const result = await query<{ id: string; slug: string; title: string | null; status: string; mode: string; created_at: string }>(
    `SELECT id, slug, title, status, mode, created_at
     FROM papers WHERE user_id = $1 ORDER BY created_at DESC`,
    [user.sub],
  );
  return NextResponse.json({ ok: true, papers: result.rows });
}
