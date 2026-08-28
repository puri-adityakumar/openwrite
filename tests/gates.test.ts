import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { query, closePool } from "../lib/db";
import {
  insertGate,
  getGate,
  getGateById,
  decideGate,
  expireOverdueGates,
  secondsUntilExpiry,
  ConflictError,
  NotFoundError,
  EXPIRY_COPY,
  type GateRow,
} from "../lib/gates";

// Phase 4.1 — gate persistence tests (RED first).
//
// These pin the durable side of the approval-gates contract:
//   - insertGate on tool.approval_required -> status='pending' + TTL set
//   - duplicate (threadId, toolCallId) is idempotent (returns existing row)
//   - decideGate -> status=allowed|denied + decided_at set
//   - re-deciding a non-pending gate -> ConflictError (409)
//   - expireOverdueGates flips past-TTL pending rows to 'expired'
//   - secondsUntilExpiry decrements over time
//
// The tests talk to a real Postgres (Phase 1.1's docker-compose.override
// has the dev DB on :5433). Each test scopes its rows to a fresh
// threadId/toolCallId so it can run in any order.

const PAPER_ID = "00000000-0000-0000-0000-000000000010"; // seed paper

// Test TTL hook so expireOverdueGates tests can run instantly.
(globalThis as { __APPROVAL_TTL_MS_FOR_TESTS?: number }).__APPROVAL_TTL_MS_FOR_TESTS = 60_000;

async function makeGate(suffix: string): Promise<GateRow> {
  return insertGate({
    paperId: PAPER_ID,
    threadId: `thr_test_${suffix}`,
    toolCallId: `tc_test_${suffix}_${Math.random().toString(36).slice(2, 6)}`,
    toolName: "bash",
    kind: "verify",
    severity: "irreversible",
    payload: { command: "python train.py --config configs/cifar.yaml" },
  });
}

afterAll(async () => {
  await closePool();
});

describe("insertGate", () => {
  it("inserts a pending gate with an expires_at in the future", async () => {
    const g = await makeGate("ins1");
    expect(g.status).toBe("pending");
    expect(g.kind).toBe("verify");
    expect(g.severity).toBe("irreversible");
    expect(g.thread_id.startsWith("thr_test_ins1")).toBe(true);
    expect(g.tool_name).toBe("bash");
    expect(new Date(g.expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("is idempotent on (threadId, toolCallId) — re-insert returns the existing row", async () => {
    const first = await makeGate("idem1");
    const second = await insertGate({
      paperId: PAPER_ID,
      threadId: first.thread_id,
      toolCallId: first.tool_call_id,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    expect(second.id).toBe(first.id);
    expect(second.status).toBe("pending");
  });
});

describe("getGate / getGateById", () => {
  it("getGate returns the row by (threadId, toolCallId)", async () => {
    const g = await makeGate("get1");
    const got = await getGate(g.thread_id, g.tool_call_id);
    expect(got.id).toBe(g.id);
  });

  it("getGate throws NotFoundError for an unknown (threadId, toolCallId)", async () => {
    await expect(
      getGate("thr_none", "tc_none"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("getGateById returns the row by id", async () => {
    const g = await makeGate("get2");
    const got = await getGateById(g.id);
    expect(got.thread_id).toBe(g.thread_id);
  });

  it("getGateById throws NotFoundError for an unknown id", async () => {
    await expect(getGateById("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("decideGate", () => {
  it("allow sets status=allowed and decided_at", async () => {
    const g = await makeGate("dec1");
    const dec = await decideGate({ gateId: g.id, decision: "allow" });
    expect(dec.status).toBe("allowed");
    expect(dec.decided_at).not.toBeNull();
    expect(new Date(dec.decided_at!).getTime()).toBeGreaterThan(0);
  });

  it("deny sets status=denied and records the reason", async () => {
    const g = await makeGate("dec2");
    const dec = await decideGate({ gateId: g.id, decision: "deny", reason: "network mode unclear" });
    expect(dec.status).toBe("denied");
    expect(dec.decided_reason).toBe("network mode unclear");
  });

  it("re-deciding a non-pending gate throws ConflictError (409)", async () => {
    const g = await makeGate("dec3");
    await decideGate({ gateId: g.id, decision: "allow" });
    await expect(
      decideGate({ gateId: g.id, decision: "deny" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("decideGate on a non-existent id throws NotFoundError", async () => {
    await expect(
      decideGate({ gateId: "00000000-0000-0000-0000-000000000000", decision: "allow" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("expireOverdueGates", () => {
  it("flips pending rows whose expires_at has passed to 'expired'", async () => {
    const g = await makeGate("exp1");
    // Force expiry by writing expires_at into the past directly.
    await query(`UPDATE gates SET expires_at = now() - interval '1 second' WHERE id = $1`, [g.id]);
    const n = await expireOverdueGates();
    expect(n).toBeGreaterThanOrEqual(1);
    const after = await getGateById(g.id);
    expect(after.status).toBe("expired");
    expect(after.decided_at).not.toBeNull();
  });

  it("does not touch non-overdue rows", async () => {
    const g = await makeGate("exp2");
    const n = await expireOverdueGates();
    // exp1 may also be flipped; we only assert that THIS row is still pending.
    expect(n).toBeGreaterThanOrEqual(0);
    const after = await getGateById(g.id);
    expect(after.status).toBe("pending");
  });
});

describe("secondsUntilExpiry", () => {
  it("returns a positive integer for a non-overdue row", () => {
    const row: GateRow = {
      id: "id", paper_id: "p", kind: "verify", severity: "irreversible",
      status: "pending", thread_id: "t", tool_call_id: "tc", tool_name: "bash",
      payload: null, expires_at: new Date(Date.now() + 90_000).toISOString(),
      decided_at: null, decided_reason: null, created_at: new Date().toISOString(),
    };
    const s = secondsUntilExpiry(row);
    expect(s).toBeGreaterThan(80);
    expect(s).toBeLessThanOrEqual(90);
  });

  it("returns 0 for an already-overdue row", () => {
    const row: GateRow = {
      id: "id", paper_id: "p", kind: "verify", severity: "irreversible",
      status: "pending", thread_id: "t", tool_call_id: "tc", tool_name: "bash",
      payload: null, expires_at: new Date(Date.now() - 1000).toISOString(),
      decided_at: null, decided_reason: null, created_at: new Date().toISOString(),
    };
    expect(secondsUntilExpiry(row)).toBe(0);
  });
});

describe("constants", () => {
  it("EXPIRY_COPY is the exact copy the spec requires", () => {
    expect(EXPIRY_COPY).toBe("approval expired — restart verification.");
  });
});

describe("expireGateRow (Qodo #2 belt-and-braces)", () => {
  it("flips a pending row whose expires_at has passed to 'expired'", async () => {
    const g = await makeGate("braces1");
    await query(`UPDATE gates SET expires_at = now() - interval '1 second' WHERE id = $1`, [g.id]);
    const { expireGateRow } = await import("../lib/gates");
    const flipped = await expireGateRow(g.id);
    expect(flipped).toBe(true);
    const after = await getGateById(g.id);
    expect(after.status).toBe("expired");
  });

  it("does not flip a row that has already been decided", async () => {
    const g = await makeGate("braces2");
    const { decideGate, expireGateRow } = await import("../lib/gates");
    await decideGate({ gateId: g.id, decision: "allow" });
    const flipped = await expireGateRow(g.id);
    expect(flipped).toBe(false);
    const after = await getGateById(g.id);
    expect(after.status).toBe("allowed");
  });

  it("does not flip a row whose expires_at is still in the future", async () => {
    const g = await makeGate("braces3");
    const { expireGateRow } = await import("../lib/gates");
    const flipped = await expireGateRow(g.id);
    expect(flipped).toBe(false);
    const after = await getGateById(g.id);
    expect(after.status).toBe("pending");
  });
});

describe("listJustExpired (Qodo #3 deny-on-expiry path)", () => {
  it("returns rows flipped in this call to expireOverdueGates", async () => {
    const g = await makeGate("just1");
    await query(`UPDATE gates SET expires_at = now() - interval '1 second' WHERE id = $1`, [g.id]);
    const { expireOverdueGates, listJustExpired } = await import("../lib/gates");
    const now = new Date();
    await expireOverdueGates(now);
    const just = await listJustExpired(now);
    expect(just.find((r) => r.id === g.id)).toBeDefined();
  });
});
