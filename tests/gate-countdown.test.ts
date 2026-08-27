import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { closePool, query } from "../lib/db";
import { insertGate, secondsUntilExpiry } from "../lib/gates";

// Phase 4.1c — countdown endpoint contract.
//
// The route `app/api/agent/gates/[id]/route.ts` (GET) returns:
//   { ok, gate, secondsRemaining }
// for any pending gate the caller owns. The route also opportunistically
// calls expireOverdueGates() so a stale pending row flips to 'expired'
// before the snapshot is read. We don't drive the route handler
// directly (it calls requireUser which needs a session cookie), but we
// pin the underlying invariants the route depends on.

const PAPER_ID = "00000000-0000-0000-0000-000000000010";

beforeAll(() => {
  // Ensure tests can short-circuit the TTL.
  (globalThis as { __APPROVAL_TTL_MS_FOR_TESTS?: number }).__APPROVAL_TTL_MS_FOR_TESTS = 60_000;
});

afterAll(async () => {
  await closePool();
});

describe("secondsRemaining computation", () => {
  it("returns a positive integer for a freshly inserted gate", async () => {
    const g = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_countdown_1",
      toolCallId: `tc_countdown_1_${Math.random().toString(36).slice(2, 6)}`,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    const s = secondsUntilExpiry(g);
    expect(s).toBeGreaterThan(50); // TTL is 60s, so >= 50 right after insert
    expect(s).toBeLessThanOrEqual(60);
  });

  it("decrements over time (read the same row twice)", async () => {
    const g = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_countdown_2",
      toolCallId: `tc_countdown_2_${Math.random().toString(36).slice(2, 6)}`,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    const first = secondsUntilExpiry(g);
    await new Promise((r) => setTimeout(r, 1100));
    const second = secondsUntilExpiry(g);
    expect(second).toBeLessThanOrEqual(first);
  });
});

describe("expireOverdueGates — countdown helper", () => {
  it("flips an overdue pending gate to 'expired' so the next snapshot is honest", async () => {
    const g = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_countdown_3",
      toolCallId: `tc_countdown_3_${Math.random().toString(36).slice(2, 6)}`,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    // Backdate expires_at.
    await query(`UPDATE gates SET expires_at = now() - interval '1 second' WHERE id = $1`, [g.id]);
    // Snapshot the row before expiry.
    const { rows: pre } = await query<{ status: string }>(
      `SELECT status FROM gates WHERE id = $1`,
      [g.id],
    );
    expect(pre[0]!.status).toBe("pending");
    // The countdown route calls expireOverdueGates() before reading.
    const { expireOverdueGates } = await import("../lib/gates");
    const n = await expireOverdueGates();
    expect(n).toBeGreaterThanOrEqual(1);
    const { rows: post } = await query<{ status: string }>(
      `SELECT status FROM gates WHERE id = $1`,
      [g.id],
    );
    expect(post[0]!.status).toBe("expired");
  });
});

describe("gates [id] route — config", () => {
  it("exports runtime = 'nodejs'", async () => {
    const mod = await import("../app/api/agent/gates/[id]/route");
    expect((mod as { runtime?: string }).runtime).toBe("nodejs");
  });

  it("exports dynamic = 'force-dynamic'", async () => {
    const mod = await import("../app/api/agent/gates/[id]/route");
    expect((mod as { dynamic?: string }).dynamic).toBe("force-dynamic");
  });
});
