// Phase 5.1 — POST /api/agent/halt.
//
// One button, two states, no third state (P6): action=pause suspends
// the run (papers.status 'paused'), action=stop terminates and LOCKS
// the run (status 'done', halted=true). A halted run refuses further
// halts, streams and approvals (locked = locked).
//
// Body: { paperId, action: "pause"|"stop" }
// Errors: 400 invalid body · 401 unauthenticated · 403 not the owner ·
//         404 unknown paper · 409 already halted / pause of a
//         non-running paper.

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../lib/db";
import { requireUser } from "../../../../lib/session";
import { appendAuditEvent } from "../../../../lib/audit";
import { getTrueForgeClient } from "../../../../lib/trueforge";
import { cancelActiveStream } from "../../../../lib/stream-registry";
import { NotFoundError, ConflictError } from "../../../../lib/gates";

export { NotFoundError, ConflictError };

// Qodo review round 2 — a stop whose TrueForge cancellation failed
// must NOT lock the paper (the upstream run would keep going with
// every retry rejected as already-halted). Surfaced as 502 so the
// user can retry Stop once the upstream is reachable again.
export class UpstreamError extends Error {
  status = 502 as const;
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HaltBody = {
  paperId?: string;
  action?: string;
};

function err(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function applyHalt(input: {
  paperId: string;
  action: "pause" | "stop";
  reason?: string;
}): Promise<{ status: string; halted: boolean }> {
  const row = await query<{ status: string; halted: boolean; session_id: string | null }>(
    `SELECT status, halted, session_id FROM papers WHERE id = $1 LIMIT 1`,
    [input.paperId],
  );
  const paper = row.rows[0];
  if (!paper) throw new NotFoundError("paper not found");
  if (paper.halted) throw new ConflictError("run is halted (locked)");

  if (input.action === "pause") {
    if (paper.status !== "running" && paper.status !== "queued") {
      throw new ConflictError(`cannot pause a ${paper.status} run`);
    }
    // Suspend execution for real (Qodo review round 2): cancel the
    // open SSE stream so no further events flow and no terminal
    // update can overwrite the paused status.
    cancelActiveStream(input.paperId);
    await query(
      `UPDATE papers SET status = 'paused', updated_at = now() WHERE id = $1`,
      [input.paperId],
    );
    await appendAuditEvent(input.paperId, { type: "halt.pause", payload: { action: "pause" } });
    return { status: "paused", halted: false };
  }

  // stop — cancel the upstream turn BEFORE locking (Qodo review round
  // 2): a failed cancellation must be retryable, so on failure we
  // return 502 WITHOUT locking. The fake adapter no-ops here.
  const reason = input.reason ?? "user";
  if (paper.session_id) {
    try {
      await getTrueForgeClient().cancelSession(paper.session_id);
    } catch (e) {
      throw new UpstreamError(`TrueForge cancelSession failed: ${(e as Error).message}`);
    }
  }
  await query(
    `UPDATE papers SET status = 'done', halted = true, halt_reason = $2, updated_at = now() WHERE id = $1`,
    [input.paperId, reason],
  );
  await appendAuditEvent(input.paperId, {
    type: "halt.stop",
    payload: { action: "stop", reason },
  });
  return { status: "done", halted: true };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return err(401, "authentication required");
  }

  let body: HaltBody;
  try {
    body = (await req.json()) as HaltBody;
  } catch {
    return err(400, "invalid JSON body");
  }
  if (!body.paperId || typeof body.paperId !== "string") {
    return err(400, "paperId is required");
  }
  if (body.action !== "pause" && body.action !== "stop") {
    return err(400, "action must be 'pause' or 'stop'");
  }

  const owner = await query<{ id: string }>(
    `SELECT id FROM papers WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [body.paperId, user.sub],
  );
  if (owner.rows.length === 0) return err(404, "paper not found");

  try {
    const out = await applyHalt({ paperId: body.paperId, action: body.action });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof UpstreamError) return err(502, e.message);
    if (e instanceof ConflictError) return err(409, e.message);
    if (e instanceof NotFoundError) return err(404, e.message);
    throw e;
  }
}
