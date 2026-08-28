import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { closePool, query } from "../lib/db";
import { __setTrueForgeClientForTest, type TrueForgeClient } from "../lib/trueforge";

// Phase 5.1 — halt route tests.
//
//   1. `applyHalt` (extracted from the route for testability):
//      - pause: papers.status -> 'paused' + audit row, NOT halted.
//      - stop:  papers.status -> 'done', halted=true, halt_reason set,
//        audit row, session cancelled on TrueForge (best-effort).
//      - no third state: pausing a done/halted paper 409s (ConflictError);
//        stopping twice 409s (the run is locked).
//   2. Route config (runtime nodejs, dynamic force-dynamic).

// Dedicated fixture paper — NEVER the seed paper (…010): these tests
// mutate status/session/halt columns, and the seeded demo render must
// stay canonical. Cascade-deleted in afterAll.
const PAPER_ID = "00000000-0000-0000-0000-000000000012";

class FakeTF implements TrueForgeClient {
  public cancelled: string[] = [];
  async startSession() {
    return { sessionId: "sess_test", turnId: "turn_test" };
  }
  async createTurnStream() {
    return {
      iterator: (async function* () {})(),
      cancel: () => {},
    };
  }
  async cancelSession(sessionId: string) {
    this.cancelled.push(sessionId);
  }
  async resumeTurnWithApproval() {
    return { turnId: "turn_resume_abc" };
  }
}

async function ensurePaper() {
  await query(
    `INSERT INTO papers (id, user_id, slug, mode, status, session_id, turn_id)
     SELECT '00000000-0000-0000-0000-000000000012', id, 'halt-playground', 'review', 'running', 'sess_halt_test', 'turn_halt_test'
     FROM users WHERE email = 'demo@local'
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function resetPaper() {
  await ensurePaper();
  await query(
    `UPDATE papers SET status = 'running', halted = false, halt_reason = NULL,
       session_id = 'sess_halt_test', turn_id = 'turn_halt_test', updated_at = now()
     WHERE id = $1`,
    [PAPER_ID],
  );
  await query(`DELETE FROM audit WHERE paper_id = $1`, [PAPER_ID]);
}

const haltStates = async () => {
  const r = await query<{ status: string; halted: boolean; halt_reason: string | null }>(
    `SELECT status, halted, halt_reason FROM papers WHERE id = $1`,
    [PAPER_ID],
  );
  return r.rows[0]!;
};

const haltAuditRows = async () => {
  const r = await query<{ type: string; payload: Record<string, unknown> }>(
    `SELECT events->>'type' AS type, events->'payload' AS payload
     FROM audit WHERE paper_id = $1 AND events->>'type' LIKE 'halt.%'
     ORDER BY id ASC`,
    [PAPER_ID],
  );
  return r.rows;
};

beforeEach(async () => {
  await resetPaper();
});

afterAll(async () => {
  __setTrueForgeClientForTest(null);
  // Cascade-deletes the fixture's audit rows too.
  await query(`DELETE FROM papers WHERE id = $1`, [PAPER_ID]);
  await closePool();
});

describe("halt route — config", () => {
  it("exports runtime = 'nodejs'", async () => {
    const mod = await import("../app/api/agent/halt/route");
    expect((mod as { runtime?: string }).runtime).toBe("nodejs");
  });

  it("exports dynamic = 'force-dynamic'", async () => {
    const mod = await import("../app/api/agent/halt/route");
    expect((mod as { dynamic?: string }).dynamic).toBe("force-dynamic");
  });
});

describe("applyHalt — pause", () => {
  it("pauses a running paper: status 'paused', not halted, audit row written", async () => {
    const fake = new FakeTF();
    __setTrueForgeClientForTest(fake);
    const { applyHalt } = await import("../app/api/agent/halt/route");
    const out = await applyHalt({ paperId: PAPER_ID, action: "pause" });
    expect(out.status).toBe("paused");
    expect(out.halted).toBe(false);
    const s = await haltStates();
    expect(s.status).toBe("paused");
    expect(s.halted).toBe(false);
    const rows = await haltAuditRows();
    expect(rows.some((r) => r.type === "halt.pause")).toBe(true);
    // Pause does NOT cancel the session (only Stop terminates).
    expect(fake.cancelled).toHaveLength(0);
  });

  it("pausing a done paper is a 409 (no third state)", async () => {
    await query(`UPDATE papers SET status = 'done' WHERE id = $1`, [PAPER_ID]);
    const { applyHalt, ConflictError } = await import("../app/api/agent/halt/route");
    await expect(applyHalt({ paperId: PAPER_ID, action: "pause" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("applyHalt — stop", () => {
  it("stops a running paper: status 'done', halted, halt_reason 'user', session cancelled", async () => {
    const fake = new FakeTF();
    __setTrueForgeClientForTest(fake);
    const { applyHalt } = await import("../app/api/agent/halt/route");
    const out = await applyHalt({ paperId: PAPER_ID, action: "stop" });
    expect(out.status).toBe("done");
    expect(out.halted).toBe(true);
    const s = await haltStates();
    expect(s.status).toBe("done");
    expect(s.halted).toBe(true);
    expect(s.halt_reason).toBe("user");
    expect(fake.cancelled).toEqual(["sess_halt_test"]);
    const rows = await haltAuditRows();
    expect(rows.some((r) => r.type === "halt.stop")).toBe(true);
  });

  it("stops a paused paper (the Pause → Stop cycle)", async () => {
    const { applyHalt } = await import("../app/api/agent/halt/route");
    await applyHalt({ paperId: PAPER_ID, action: "pause" });
    const out = await applyHalt({ paperId: PAPER_ID, action: "stop" });
    expect(out.status).toBe("done");
    expect(out.halted).toBe(true);
    const rows = await haltAuditRows();
    expect(rows.map((r) => r.type)).toEqual(["halt.pause", "halt.stop"]);
  });

  it("stopping twice is a 409 — a halted run is locked", async () => {
    const { applyHalt, ConflictError } = await import("../app/api/agent/halt/route");
    await applyHalt({ paperId: PAPER_ID, action: "stop" });
    await expect(applyHalt({ paperId: PAPER_ID, action: "stop" })).rejects.toBeInstanceOf(ConflictError);
  });

  it("a cap stop records halt_reason 'cap' in the same locked shape", async () => {
    const { applyHalt } = await import("../app/api/agent/halt/route");
    await applyHalt({ paperId: PAPER_ID, action: "stop", reason: "cap" });
    const s = await haltStates();
    expect(s.halted).toBe(true);
    expect(s.halt_reason).toBe("cap");
    const rows = await haltAuditRows();
    const stop = rows.find((r) => r.type === "halt.stop");
    expect(stop?.payload).toMatchObject({ reason: "cap" });
  });

  it("halt on an unknown paper throws NotFoundError", async () => {
    const { applyHalt, NotFoundError } = await import("../app/api/agent/halt/route");
    await expect(
      applyHalt({ paperId: "00000000-0000-0000-0000-00000000dead", action: "pause" }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
