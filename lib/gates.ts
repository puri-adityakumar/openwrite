// Phase 4.1 — gate persistence + approval-decision helpers.
//
// The reducer already tracks in-flight `Gate` objects in `state.gates`
// (threadId, toolCallId, toolName) so the cockpit can render "1 pending
// approval" without a DB roundtrip. This file is the **durable** mirror
// of that state: every approval_required event writes a row to the
// `gates` table; every Allow/Deny/Expire decision updates it. The UI's
// countdown + status are sourced from the row, not the live event stream.
//
// Contract (binding spec, docs/approval-gates.md):
//   - on `tool.approval_required` -> insertGate(...):  status='pending',
//     paper status -> 'paused', TTL = APPROVAL_TTL_MS from now.
//   - Allow/Deny  -> decideGate(): status -> 'allowed' | 'denied',
//     decided_at set, expiry cleared. Re-deciding a non-pending gate
//     returns ConflictError -> route returns 409.
//   - On TTL expiry: expireGate() -> status='expired' (treated as deny
//     with the exact copy "approval expired — restart verification.").
//   - Resume contract: the resume turn on the same threadId carries a
//     `user.tool_approval` input item and **must not** mix with
//     `user.message`. The decision shape is enforced at the call site
//     (decideGate returns a typed Decision), not here.

import { query } from "./db";

export type GateKind = "verify" | "publish" | "save";
export type GateSeverity = "reversible" | "irreversible";
export type GateStatus = "pending" | "allowed" | "denied" | "expired";

export type GateRow = {
  id: string;
  paper_id: string;
  kind: GateKind;
  severity: GateSeverity;
  status: GateStatus;
  thread_id: string;
  tool_call_id: string;
  tool_name: string;
  payload: Record<string, unknown> | null;
  expires_at: string;
  decided_at: string | null;
  decided_reason: string | null;
  created_at: string;
};

// Phase 4.1: server-side TTL. The plan allows 5–30 min; we default to
// 5 minutes in dev and 15 minutes in any environment that exposes
// TRUEFORGE_MODE=live. TC-3 (the expiry E2E) overrides this via
// __APPROVAL_TTL_MS_FOR_TESTS.
export const APPROVAL_TTL_MS = (() => {
  const fromEnv = process.env.APPROVAL_TTL_MS;
  if (fromEnv) {
    const n = Number(fromEnv);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return process.env.TRUEFORGE_MODE === "live" ? 15 * 60_000 : 5 * 60_000;
})();

export class ConflictError extends Error {
  status = 409 as const;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class NotFoundError extends Error {
  status = 404 as const;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export type InsertGateInput = {
  paperId: string;
  threadId: string;
  toolCallId: string;
  toolName: string;
  kind: GateKind;
  severity: GateSeverity;
  payload?: Record<string, unknown>;
};

// Insert (or upsert) a pending gate for (threadId, toolCallId). The
// unique key is (threadId, toolCallId) so duplicate approval_required
// events from the upstream don't double-insert. Returns the row.
export async function insertGate(input: InsertGateInput): Promise<GateRow> {
  const ttl = (): number => {
    // Test hook: tests can set __APPROVAL_TTL_MS_FOR_TESTS to shorten
    // the TTL for TC-3 (expiry E2E).
    const fromTest = (globalThis as { __APPROVAL_TTL_MS_FOR_TESTS?: number })
      .__APPROVAL_TTL_MS_FOR_TESTS;
    return typeof fromTest === "number" && fromTest > 0 ? fromTest : APPROVAL_TTL_MS;
  };
  const expiresAt = new Date(Date.now() + ttl()).toISOString();
  // The unique key is (thread_id, tool_call_id). ON CONFLICT here
  // must target that constraint — DO NOTHING returns zero rows and we
  // fall through to a SELECT to fetch the existing row.
  const { rows } = await query<GateRow>(
    `INSERT INTO gates
       (paper_id, kind, severity, status, payload, thread_id, tool_call_id, tool_name, expires_at)
     VALUES ($1, $2, $3, 'pending', $4::jsonb, $5, $6, $7, $8)
     ON CONFLICT (thread_id, tool_call_id) DO NOTHING
     RETURNING id, paper_id, kind, severity, status, thread_id, tool_call_id,
               tool_name, payload, expires_at, decided_at, decided_reason, created_at`,
    [
      input.paperId,
      input.kind,
      input.severity,
      JSON.stringify(input.payload ?? {}),
      input.threadId,
      input.toolCallId,
      input.toolName,
      expiresAt,
    ],
  );
  if (rows.length > 0) return rows[0]!;
  // Row already existed — fetch it. (Defence in depth: the caller
  // should treat the returned row as the source of truth.)
  return getGate(input.threadId, input.toolCallId);
}

export async function getGate(threadId: string, toolCallId: string): Promise<GateRow> {
  const { rows } = await query<GateRow>(
    `SELECT id, paper_id, kind, severity, status, thread_id, tool_call_id,
            tool_name, payload, expires_at, decided_at, decided_reason, created_at
       FROM gates
      WHERE thread_id = $1 AND tool_call_id = $2
      LIMIT 1`,
    [threadId, toolCallId],
  );
  if (rows.length === 0) throw new NotFoundError(`gate not found: ${threadId}/${toolCallId}`);
  return rows[0]!;
}

export async function getGateById(id: string): Promise<GateRow> {
  const { rows } = await query<GateRow>(
    `SELECT id, paper_id, kind, severity, status, thread_id, tool_call_id,
            tool_name, payload, expires_at, decided_at, decided_reason, created_at
       FROM gates
      WHERE id = $1
      LIMIT 1`,
    [id],
  );
  if (rows.length === 0) throw new NotFoundError(`gate not found: ${id}`);
  return rows[0]!;
}

export type Decision = "allow" | "deny";

export type DecideInput = {
  gateId: string;
  decision: Decision;
  reason?: string;
};

// Apply a user decision to a pending gate. Returns the updated row.
// Throws ConflictError if the gate is not in `pending` state (the spec
// calls this out: replaying an approval for a non-pending gate is a
// 409). Throws NotFoundError if the gate does not exist.
export async function decideGate(input: DecideInput): Promise<GateRow> {
  const target = await getGateById(input.gateId);
  if (target.status !== "pending") {
    throw new ConflictError(`gate already ${target.status}`);
  }
  const status: GateStatus = input.decision === "allow" ? "allowed" : "denied";
  const { rows } = await query<GateRow>(
    `UPDATE gates
        SET status = $2,
            decided_at = now(),
            decided_reason = $3
      WHERE id = $1
        AND status = 'pending'
      RETURNING id, paper_id, kind, severity, status, thread_id, tool_call_id,
                tool_name, payload, expires_at, decided_at, decided_reason, created_at`,
    [input.gateId, status, input.reason ?? null],
  );
  if (rows.length === 0) {
    // Lost a race — another decision was applied between our getGateById
    // and the update. Report 409 to the caller.
    throw new ConflictError(`gate already decided`);
  }
  return rows[0]!;
}

// Mark all currently-pending gates whose expires_at has passed as
// 'expired'. Returns the count of gates transitioned. Called by the
// countdown tick (every 5 s) and once on the route handler.
export async function expireOverdueGates(now: Date = new Date()): Promise<number> {
  const { rowCount } = await query(
    `UPDATE gates
        SET status = 'expired',
            decided_at = $1
      WHERE status = 'pending'
        AND expires_at <= $1`,
    [now.toISOString()],
  );
  return rowCount ?? 0;
}

// Compute the seconds remaining until this gate expires. Negative when
// already overdue (the route uses that signal to flip to expired first).
export function secondsUntilExpiry(row: GateRow, now: Date = new Date()): number {
  const ms = new Date(row.expires_at).getTime() - now.getTime();
  return Math.max(0, Math.floor(ms / 1000));
}

export const EXPIRY_COPY = "approval expired — restart verification.";
