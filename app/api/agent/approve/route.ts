// Phase 4.1 — POST /api/agent/approve.
//
// Per the binding spec (docs/approval-gates.md), the approve route
// is the single way the cockpit turns a pending gate into a decision
// AND resumes the paused turn on the same `threadId` with a
// `user.tool_approval` input item (no mixing with `user.message`).
//
// Body: { gateId, decision: "allow"|"deny", reason?: string }
// Returns: { ok, gate, resumedTurnId } on success.
// Errors:
//   400 invalid JSON / missing fields / non-string reason
//   401 authentication required
//   403 paper does not belong to the caller
//   404 gate not found
//   409 gate already decided (replay)
//   409 gate no longer pending upstream (TrueForge 422 — the stale row
//      is expired server-side so the cockpit refreshes instead of
//      retrying a decision that can never land)

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../lib/db";
import { requireUser } from "../../../../lib/session";
import {
  decideGate,
  getGateById,
  expireGateRow,
  markGateStale,
  ConflictError,
  NotFoundError,
  type GateRow,
} from "../../../../lib/gates";
import { appendAuditEvent } from "../../../../lib/audit";
import { getTrueForgeClient, type TrueForgeClient } from "../../../../lib/trueforge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApproveBody = {
  gateId?: string;
  decision?: string;
  reason?: string;
};

function err(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// Pure decision function — extracted from the route so unit tests can
// exercise the resume-turn shape (no mixing with user.message) without
// touching the DB or network. Throws ConflictError on replay, NotFoundError
// on missing gate, Error on shape violations.
//
// Reliability contract (Qodo #1): we resume the TrueForge turn FIRST
// and only commit the decision to the DB on success. A network
// failure on resume returns 502 with the gate still in 'pending', so
// the user can retry. A failure on the DB commit after a successful
// resume is the only path that leaves the system in a slightly
// inconsistent state — the TrueForge turn will have been resumed
// without a record; the cockpit's next reload will pick up the
// resumed turn (the papers.turn_id is updated by the route handler
// after this function returns).
export async function applyApproval(input: {
  gate: GateRow;
  sessionId: string;
  decision: "allow" | "deny";
  reason?: string;
}): Promise<{ gate: GateRow; resumedTurnId: string }> {
  // Qodo #2 — refuse to decide a gate whose TTL has already passed.
  // The route's expireOverdueGates() is opportunistic; this is a
  // belt-and-braces check at the point of decision.
  if (new Date(input.gate.expires_at).getTime() <= Date.now()) {
    // Mark it expired first (idempotent: decideGate would have
    // thrown ConflictError on the next call anyway), then surface a
    // ConflictError so the route returns 409.
    await expireGateRow(input.gate.id);
    throw new ConflictError(`gate expired at ${input.gate.expires_at}`);
  }

  // Resume FIRST so a network failure leaves the gate in 'pending'.
  const client = getTrueForgeClient();
  const resumeInput: Parameters<TrueForgeClient["resumeTurnWithApproval"]>[0] = {
    sessionId: input.sessionId,
    threadId: input.gate.thread_id,
    toolCallId: input.gate.tool_call_id,
    decision: input.decision,
  };
  if (input.reason !== undefined) resumeInput.reason = input.reason;
  let turnId: string;
  try {
    ({ turnId } = await client.resumeTurnWithApproval(resumeInput));
  } catch (e) {
    // Stale-approval self-healing: TrueForge answers 422 "no pending
    // approval for tool_call_id" when the run already consumed/moved
    // past the approval but our gate row stayed 'pending'. Retrying can
    // never succeed — it used to loop 502s forever. Mark the row
    // expired with the truthful reason and surface a 409 so the
    // cockpit refreshes instead of retrying.
    if (/no pending approval/i.test((e as Error).message)) {
      await markGateStale(input.gate.id, "no longer pending upstream").catch(() => {});
      throw new ConflictError("approval no longer pending upstream — the run already moved past it");
    }
    throw e;
  }

  // Only NOW commit the decision. If the DB write fails after the
  // resume, the cockpit's next reload sees the resumed turn (we
  // update papers.turn_id) and the gate row remains pending — the
  // next user retry will resume again (idempotent on TrueForge's
  // side) and finally decide.
  const decided = await decideGate({ gateId: input.gate.id, decision: input.decision, reason: input.reason });
  return { gate: decided, resumedTurnId: turnId };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return err(401, "authentication required");
  }

  let body: ApproveBody;
  try {
    body = (await req.json()) as ApproveBody;
  } catch {
    return err(400, "invalid JSON body");
  }
  if (!body.gateId || typeof body.gateId !== "string") {
    return err(400, "gateId is required");
  }
  if (body.decision !== "allow" && body.decision !== "deny") {
    return err(400, "decision must be 'allow' or 'deny'");
  }
  if (body.reason !== undefined && typeof body.reason !== "string") {
    return err(400, "reason must be a string when present");
  }

  // Load the gate; verify the caller owns the paper.
  let gate: GateRow;
  try {
    gate = await getGateById(body.gateId);
  } catch (e) {
    if (e instanceof NotFoundError) return err(404, "gate not found");
    throw e;
  }
  const owner = await query<{ session_id: string | null; halted: boolean }>(
    `SELECT session_id, halted FROM papers WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [gate.paper_id, user.sub],
  );
  if (owner.rows.length === 0) return err(403, "forbidden");
  // Phase 5.1 — a halted run is locked: no approvals on a stopped run.
  if (owner.rows[0]!.halted) return err(409, "run is halted (locked)");
  const sessionId = owner.rows[0]!.session_id;
  if (!sessionId) return err(409, "paper has no active session");

  // Apply the decision + resume the turn. Any 409 from decideGate or
  // a network failure from the TrueForge client surfaces here.
  try {
    const result = await applyApproval({
      gate,
      sessionId,
      decision: body.decision,
      reason: body.reason,
    });
    // Qodo #4 — the resumed turn becomes the paper's current turn;
    // the next cockpit reload reattaches the SSE stream to it.
    // We also flip paper.status back to 'running' so the cockpit
    // leaves the paused state. A failure here is best-effort — the
    // resume already happened on TrueForge's side.
    try {
      await query(
        `UPDATE papers SET turn_id = $1, status = 'running', updated_at = now() WHERE id = $2`,
        [result.resumedTurnId, gate.paper_id],
      );
    } catch (e) {
      console.error("[approve] papers.turn_id update failed:", (e as Error).message);
    }
    // Phase 5.2 — the audit vocabulary needs the decision row
    // ("✓ user allowed" / "✗ user denied"). Best-effort: the decision
    // itself is already durable on the gate row.
    try {
      await appendAuditEvent(gate.paper_id, {
        type: "gate.decision",
        payload: { decision: body.decision, reason: body.reason ?? null, gateId: gate.id },
      });
    } catch (e) {
      console.error("[approve] audit decision row failed:", (e as Error).message);
    }
    return NextResponse.json({
      ok: true,
      gate: result.gate,
      resumedTurnId: result.resumedTurnId,
    });
  } catch (e) {
    if (e instanceof ConflictError) return err(409, e.message);
    return err(502, `approval failed: ${(e as Error).message}`);
  }
}
