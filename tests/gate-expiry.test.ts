import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { query, closePool } from "../lib/db";
import { insertGate, getGateById, EXPIRY_COPY } from "../lib/gates";
import { __setTrueForgeClientForTest, type TrueForgeClient } from "../lib/trueforge";

// Qodo review #3 — deny-on-expiry must ALSO unblock the cockpit: the
// expired gate's TrueForge turn is resumed with a deny, and the paper
// reattaches to the resumed turn (turn_id + status bookkeeping).
// Without the bookkeeping the cockpit stays glued to the old paused
// turn even though upstream already moved on.

// Dedicated fixture paper — never the seed paper (…010).
const PID = "00000000-0000-0000-0000-000000000015";

class SpyTF implements TrueForgeClient {
  public calls: Array<{ sessionId: string; threadId: string; toolCallId: string; decision: string; reason?: string }> = [];
  public failNext = false;
  async startSession() {
    return { sessionId: "sess_exp", turnId: "turn_exp" };
  }
  async createTurnStream() {
    return { iterator: (async function* () {})(), cancel: () => {} };
  }
  async cancelSession() {}
  async resumeTurnWithApproval(input: { sessionId: string; threadId: string; toolCallId: string; decision: "allow" | "deny"; reason?: string }) {
    this.calls.push({ ...input });
    if (this.failNext) throw new Error("resume unavailable");
    return { turnId: `turn_resumed_${this.calls.length}` };
  }
}

async function ensurePaper() {
  await query(
    `INSERT INTO papers (id, user_id, slug, mode, status, session_id, turn_id)
     SELECT '00000000-0000-0000-0000-000000000015', id, 'gate-expiry-playground', 'review', 'paused', 'sess_exp', 'turn_paused'
     FROM users WHERE email = 'demo@local'
     ON CONFLICT (id) DO NOTHING`,
  );
  await query(
    `UPDATE papers SET status = 'paused', session_id = 'sess_exp', turn_id = 'turn_paused', halted = false WHERE id = $1`,
    [PID],
  );
}

async function makeOverdueGate(label: string) {
  const g = await insertGate({
    paperId: PID,
    threadId: `thr_exp_${label}_${Math.random().toString(36).slice(2, 6)}`,
    toolCallId: `tc_exp_${label}_${Math.random().toString(36).slice(2, 6)}`,
    toolName: "bash",
    kind: "verify",
    severity: "irreversible",
    payload: {},
  });
  await query(`UPDATE gates SET expires_at = now() - interval '1 second' WHERE id = $1`, [g.id]);
  return g;
}

const paperRow = async () =>
  (
    await query<{ turn_id: string; status: string }>(
      `SELECT turn_id, status FROM papers WHERE id = $1`,
      [PID],
    )
  ).rows[0]!;

beforeEach(async () => {
  await ensurePaper();
  await query(`DELETE FROM gates WHERE paper_id = $1`, [PID]);
});

afterAll(async () => {
  __setTrueForgeClientForTest(null);
  await query(`DELETE FROM papers WHERE id = $1`, [PID]);
  await closePool();
});

describe("resolveExpiredGates — deny-on-expiry + bookkeeping", () => {
  it("resumes the expired gate's turn with deny + EXPIRY_COPY and reattaches the paper", async () => {
    const spy = new SpyTF();
    __setTrueForgeClientForTest(spy);
    const g = await makeOverdueGate("a");
    const { resolveExpiredGates } = await import("../lib/gate-expiry");
    const n = await resolveExpiredGates();
    expect(n).toBeGreaterThanOrEqual(1);
    const call = spy.calls.find((c) => c.toolCallId === g.tool_call_id);
    expect(call).toMatchObject({ sessionId: "sess_exp", decision: "deny", reason: EXPIRY_COPY });
    // The paper reattaches to the resumed turn and leaves the pause.
    const row = await paperRow();
    expect(row.turn_id).toBe(`turn_resumed_${spy.calls.indexOf(call!) + 1}`);
    expect(row.status).toBe("running");
    expect((await getGateById(g.id)).status).toBe("expired");
  });

  it("a failed resume leaves the paper untouched and does not throw", async () => {
    const spy = new SpyTF();
    spy.failNext = true;
    __setTrueForgeClientForTest(spy);
    const g = await makeOverdueGate("b");
    const { resolveExpiredGates } = await import("../lib/gate-expiry");
    await expect(resolveExpiredGates()).resolves.toBeGreaterThanOrEqual(0);
    // Gate row is still terminal; the paper keeps its old turn.
    expect((await getGateById(g.id)).status).toBe("expired");
    expect(await paperRow()).toMatchObject({ turn_id: "turn_paused", status: "paused" });
  });

  it("skips gates whose paper has no live session", async () => {
    const spy = new SpyTF();
    __setTrueForgeClientForTest(spy);
    const g = await makeOverdueGate("c");
    await query(`UPDATE papers SET session_id = NULL WHERE id = $1`, [PID]);
    const { resolveExpiredGates } = await import("../lib/gate-expiry");
    await resolveExpiredGates();
    expect(spy.calls.find((c) => c.toolCallId === g.tool_call_id)).toBeUndefined();
  });

  it("is a no-op when nothing is overdue", async () => {
    const spy = new SpyTF();
    __setTrueForgeClientForTest(spy);
    await insertGate({
      paperId: PID,
      threadId: `thr_exp_fresh_${Math.random().toString(36).slice(2, 6)}`,
      toolCallId: `tc_exp_fresh_${Math.random().toString(36).slice(2, 6)}`,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
      payload: {},
    });
    const { resolveExpiredGates } = await import("../lib/gate-expiry");
    expect(await resolveExpiredGates()).toBe(0);
    expect(spy.calls).toHaveLength(0);
  });
});
