import { describe, it, expect, afterAll } from "vitest";
import { closePool, query } from "../lib/db";
import { insertGate, getGateById, type GateRow } from "../lib/gates";
import { __setTrueForgeClientForTest, type TrueForgeClient } from "../lib/trueforge";

// Phase 4.1 — approve route tests.
//
// Two layers:
//   1. Route config (runtime: "nodejs" + dynamic: "force-dynamic").
//   2. `applyApproval` (extracted from the route for testability):
//      - calls decideGate (allow|deny),
//      - calls the TrueForge client with a resume input whose
//        `decision` matches the gate's kind, **never** mixed with
//        user.message,
//      - returns { gate, resumedTurnId }.
//
// We mock the TrueForge client with a test double so the resume
// contract is observable from the test (no real network).

const PAPER_ID = "00000000-0000-0000-0000-000000000010";

// Each test gets a fresh toolCallId so the gates table doesn't carry
// state across runs (the unique key on (thread_id, tool_call_id) plus
// decideGate's pending-state check would otherwise 409 the re-run).
const fresh = (label: string) => `tc_app_${label}_${Math.random().toString(36).slice(2, 8)}`;

class FakeTF implements TrueForgeClient {
  public lastResume: unknown = null;
  async startSession() {
    return { sessionId: "sess_test", turnId: "turn_test" };
  }
  async createTurnStream() {
    // Unused by these tests.
    return {
      iterator: (async function* () {})(),
      cancel: () => {},
    };
  }
  async cancelSession() {}
  async resumeTurnWithApproval(input: unknown) {
    this.lastResume = input;
    return { turnId: "turn_resume_abc" };
  }
}

afterAll(async () => {
  __setTrueForgeClientForTest(null);
  // applyApproval writes gate.decision audit rows against the seed
  // paper fixture — clean up so the seeded audit stays canonical.
  await query(`DELETE FROM audit WHERE paper_id = $1 AND events->>'type' = 'gate.decision'`, [PAPER_ID]);
  await closePool();
});

describe("approve route — config", () => {
  it("exports runtime = 'nodejs'", async () => {
    const mod = await import("../app/api/agent/approve/route");
    expect((mod as { runtime?: string }).runtime).toBe("nodejs");
  });

  it("exports dynamic = 'force-dynamic'", async () => {
    const mod = await import("../app/api/agent/approve/route");
    expect((mod as { dynamic?: string }).dynamic).toBe("force-dynamic");
  });
});

describe("applyApproval — resume turn shape", () => {
  it("allow path: calls decideGate + resumeTurnWithApproval, returns resumedTurnId", async () => {
    const fake = new FakeTF();
    __setTrueForgeClientForTest(fake);
    const tc = fresh("allow");
    const gate = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_app_allow",
      toolCallId: tc,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
      payload: { command: "python train.py" },
    });
    const { applyApproval } = await import("../app/api/agent/approve/route");
    const out = await applyApproval({ gate, sessionId: "sess_app1", decision: "allow" });
    expect(out.gate.status).toBe("allowed");
    expect(out.gate.decided_at).not.toBeNull();
    expect(out.resumedTurnId).toBe("turn_resume_abc");
    expect((fake.lastResume as { decision: string }).decision).toBe("allow");
    expect((fake.lastResume as { threadId: string }).threadId).toBe("thr_app_allow");
    expect((fake.lastResume as { toolCallId: string }).toolCallId).toBe(tc);
  });

  it("deny path: passes the reason into the resume input", async () => {
    const fake = new FakeTF();
    __setTrueForgeClientForTest(fake);
    const tc = fresh("deny");
    const gate = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_app_deny",
      toolCallId: tc,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    const { applyApproval } = await import("../app/api/agent/approve/route");
    const out = await applyApproval({
      gate,
      sessionId: "sess_app2",
      decision: "deny",
      reason: "network mode unclear",
    });
    expect(out.gate.status).toBe("denied");
    expect(out.gate.decided_reason).toBe("network mode unclear");
    expect((fake.lastResume as { decision: string }).decision).toBe("deny");
    expect((fake.lastResume as { reason: string }).reason).toBe("network mode unclear");
  });

  it("replay: re-applying a decision on a non-pending gate throws ConflictError", async () => {
    const fake = new FakeTF();
    __setTrueForgeClientForTest(fake);
    const tc = fresh("replay");
    const gate = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_app_replay",
      toolCallId: tc,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    const { applyApproval } = await import("../app/api/agent/approve/route");
    await applyApproval({ gate, sessionId: "sess_app3", decision: "allow" });
    // Re-decide on the same gate (now 'allowed') -> ConflictError.
    await expect(
      applyApproval({ gate, sessionId: "sess_app3", decision: "deny" }),
    ).rejects.toThrow(/already allowed/i);
  });
});

describe("applyApproval — no mixed input (binding)", () => {
  it("the resume input carries only tool_approval fields (no user.message, content, or input list)", async () => {
    const fake = new FakeTF();
    __setTrueForgeClientForTest(fake);
    const tc = fresh("nomix");
    const gate: GateRow = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_nomix",
      toolCallId: tc,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    const { applyApproval } = await import("../app/api/agent/approve/route");
    await applyApproval({ gate, sessionId: "sess_nomix", decision: "allow" });
    const sent = fake.lastResume as Record<string, unknown>;
    // Allowed keys: sessionId, threadId, toolCallId, decision, reason?
    // Disallowed keys (would imply user.message mixing): message,
    // content, input (array of items), text.
    const keys = Object.keys(sent).sort();
    expect(keys).toEqual(["decision", "sessionId", "threadId", "toolCallId"]);
    expect(sent.sessionId).toBe("sess_nomix");
    expect(sent.threadId).toBe("thr_nomix");
    expect(sent.toolCallId).toBe(tc);
    expect(sent.decision).toBe("allow");
    expect("message" in sent).toBe(false);
    expect("content" in sent).toBe(false);
    expect("input" in sent).toBe(false);
    expect("text" in sent).toBe(false);
  });

  it("the resume input includes reason when provided (deny path)", async () => {
    const fake = new FakeTF();
    __setTrueForgeClientForTest(fake);
    const tc = fresh("nomix2");
    const gate: GateRow = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_nomix2",
      toolCallId: tc,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    const { applyApproval } = await import("../app/api/agent/approve/route");
    await applyApproval({
      gate,
      sessionId: "sess_nomix2",
      decision: "deny",
      reason: "user typed reason",
    });
    const sent = fake.lastResume as Record<string, unknown>;
    expect(sent.reason).toBe("user typed reason");
    expect("message" in sent).toBe(false);
    expect("content" in sent).toBe(false);
  });
});

describe("applyApproval — reliability (Qodo #1, #2)", () => {
  it("Qodo #1: resumes the TrueForge turn BEFORE deciding the gate row", async () => {
    // Spy on the order: record the gate's DB status at the moment
    // resumeTurnWithApproval fires. If the order is correct, the
    // status will still be 'pending' inside the resume call (because
    // decideGate has not yet run); the post-call assertion then
    // confirms the gate has moved to 'allowed'.
    const order: { atResume: string | null; atEnd: string | null } = {
      atResume: null,
      atEnd: null,
    };
    let gateIdForSpy = "";
    const fake = new (class extends FakeTF {
      async resumeTurnWithApproval(input: unknown) {
        const { getGateById } = await import("../lib/gates");
        const g = await getGateById(gateIdForSpy);
        order.atResume = g.status;
        this.lastResume = input;
        return { turnId: "turn_resume_order" };
      }
    })();
    __setTrueForgeClientForTest(fake);
    const tc = fresh("reliability1");
    const gate: GateRow = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_rel1",
      toolCallId: tc,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    gateIdForSpy = gate.id;
    const { applyApproval } = await import("../app/api/agent/approve/route");
    await applyApproval({ gate, sessionId: "sess_rel1", decision: "allow" });
    const after = await getGateById(gate.id);
    order.atEnd = after.status;
    // At the moment resume was called, the gate row was still
    // 'pending' (decideGate had not yet run). By the end, the
    // gate row is 'allowed' (decideGate ran AFTER the resume).
    expect(order.atResume).toBe("pending");
    expect(order.atEnd).toBe("allowed");
  });

  it("Qodo #1: a resume failure leaves the gate 'pending' (no early consume)", async () => {
    class FailTF extends FakeTF {
      async resumeTurnWithApproval() {
        throw new Error("upstream down");
      }
    }
    const fake = new FailTF();
    __setTrueForgeClientForTest(fake);
    const tc = fresh("reliability2");
    const gate: GateRow = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_rel2",
      toolCallId: tc,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    const { applyApproval } = await import("../app/api/agent/approve/route");
    await expect(
      applyApproval({ gate, sessionId: "sess_rel2", decision: "allow" }),
    ).rejects.toThrow(/upstream down/);
    // Gate must still be 'pending' so the user can retry.
    const after = await getGateById(gate.id);
    expect(after.status).toBe("pending");
  });

  it("Qodo #2: refuses to decide a gate whose TTL has already passed", async () => {
    const fake = new FakeTF();
    __setTrueForgeClientForTest(fake);
    const tc = fresh("reliability3");
    const gate: GateRow = await insertGate({
      paperId: PAPER_ID,
      threadId: "thr_rel3",
      toolCallId: tc,
      toolName: "bash",
      kind: "verify",
      severity: "irreversible",
    });
    // Backdate expires_at to 1s ago.
    await query(`UPDATE gates SET expires_at = now() - interval '1 second' WHERE id = $1`, [gate.id]);
    // Refetch the gate — the in-memory `gate` object still has the
    // original (not-yet-expired) expires_at; applyApproval's check
    // reads `input.gate.expires_at`, so we must pass the refetched row.
    const stale = await getGateById(gate.id);
    const { applyApproval } = await import("../app/api/agent/approve/route");
    await expect(
      applyApproval({ gate: stale, sessionId: "sess_rel3", decision: "allow" }),
    ).rejects.toThrow(/expired/);
    // The gate should now be 'expired' (flipped by the belt-and-braces
    // expireGateRow call inside applyApproval).
    const after = await getGateById(gate.id);
    expect(after.status).toBe("expired");
    // The TrueForge client should NOT have been called — the TTL
    // guard runs before the resume.
    expect(fake.lastResume).toBeNull();
  });
});
