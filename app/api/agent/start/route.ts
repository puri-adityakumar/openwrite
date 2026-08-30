// Phase 2.1 — POST /api/agent/start.
//
// Creates a TrueForge session + first turn for the requested paper, then
// persists session_id/turn_id on the paper row and flips status to
// "running". The browser navigates to /paper/[slug] which opens an
// EventSource against /api/agent/stream (P7 pipeline).
//
// Per Phase 2.1#1, the only side effect of /start is to allocate a
// session + turn + persist the IDs. The actual streaming happens in
// /stream.

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../lib/db";
import { requireUser } from "../../../../lib/session";
import { getTrueForgeClient } from "../../../../lib/trueforge";
import { parseSource } from "../../../../lib/source-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StartBody = {
  paperId?: string;
  mode?: "learn" | "deep-read" | "review";
  source?: string;
};

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
  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return err(400, "invalid JSON body");
  }
  if (!body.paperId) return err(400, "paperId is required");
  if (!body.mode || !["learn", "deep-read", "review"].includes(body.mode)) {
    return err(400, "mode must be learn|deep-read|review");
  }
  if (!body.source) return err(400, "source is required");

  // Ownership check.
  const owner = await query<{ id: string; slug: string }>(
    `SELECT id, slug FROM papers WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [body.paperId, user.sub],
  );
  if (owner.rows.length === 0) return err(404, "paper not found");

  // Normalize the first user message. Any accepted arXiv form (bare id,
  // /abs/, /pdf/) becomes a canonical, explicit download instruction
  // with an abstract-page fallback so the agent never has to guess from
  // a raw link; every other source passes through verbatim.
  const parsedSource = parseSource(body.source);
  const source =
    parsedSource.kind === "arxiv"
      ? `Download the paper PDF at ${parsedSource.pdfUrl} (arXiv:${parsedSource.id}${parsedSource.version ?? ""}). If the direct PDF fetch fails, fall back to the abstract page ${parsedSource.absUrl}.`
      : body.source;

  // Create session + first turn against the TrueForge client.
  const client = getTrueForgeClient();
  const { sessionId, turnId } = await client.startSession({
    paperId: body.paperId,
    mode: body.mode,
    source,
  });

  // Persist session_id/turn_id + flip status to "running".
  await query(
    `UPDATE papers SET session_id = $1, turn_id = $2, status = 'running', updated_at = now()
     WHERE id = $3`,
    [sessionId, turnId, body.paperId],
  );

  return NextResponse.json({
    ok: true,
    paperId: body.paperId,
    slug: owner.rows[0]!.slug,
    sessionId,
    turnId,
    streamUrl: `/api/agent/stream?sessionId=${encodeURIComponent(sessionId)}&turnId=${encodeURIComponent(turnId)}&paperId=${encodeURIComponent(body.paperId)}`,
  });
}
