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

import { NextResponse, type NextRequest } from "next/server";
import { query } from "../../../../lib/db";
import { requireUser } from "../../../../lib/session";
import {
  decideGate,
  getGateById,
  ConflictError,
  NotFoundError,
  type GateRow,
} from "../../../../lib/gates";
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
export async function applyApproval(input: {
  gate: GateRow;
  sessionId: string;
  decision: "allow" | "deny";
  reason?: string;
}): Promise<{ gate: GateRow; resumedTurnId: string }> {
  const decided = await decideGate({ gateId: input.gate.id, decision: input.decision, reason: input.reason });
  const client = getTrueForgeClient();
  // Build the resume input WITHOUT an undefined `reason` key so the
  // shape sent to the TrueForge client is exactly
  // { sessionId, threadId, toolCallId, decision, reason? } — never
  // mixed with a user.message-shaped field.
  const resumeInput: Parameters<TrueForgeClient["resumeTurnWithApproval"]>[0] = {
    sessionId: input.sessionId,
    threadId: input.gate.thread_id,
    toolCallId: input.gate.tool_call_id,
    decision: input.decision,
  };
  if (input.reason !== undefined) resumeInput.reason = input.reason;
  const { turnId } = await client.resumeTurnWithApproval(resumeInput);
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
  const owner = await query<{ session_id: string | null }>(
    `SELECT session_id FROM papers WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [gate.paper_id, user.sub],
  );
  if (owner.rows.length === 0) return err(403, "forbidden");
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
