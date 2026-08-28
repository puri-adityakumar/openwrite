import { describe, it, expect } from "vitest";

// Phase 4 — Qodo #5: the fake resume memory must hand a real
// (post-resume) event sequence to the next createTurnStream call
// instead of looping back to the same paused sequence.

describe("FakeTrueForgeClient — resume memory (Qodo #5)", () => {
  it("resumeTurnWithApproval stores a post-resume sequence keyed by (sessionId, turnId)", async () => {
    // Use the real client (the default is fake in dev).
    const { getTrueForgeClient } = await import("../lib/trueforge");
    const client = getTrueForgeClient();
    const sessionId = `sess_test_${Math.random().toString(36).slice(2, 6)}`;
    const { turnId } = await client.resumeTurnWithApproval({
      sessionId,
      threadId: "thr_resume",
      toolCallId: "tc_resume",
      decision: "allow",
    });
    expect(turnId).toMatch(/^turn_resume_/);
    // Pull the stream for the new turnId; it should produce a
    // post-resume sequence (turn.created + model.message.delta +
    // turn.done), NOT the default paused sequence.
    const stream = await client.createTurnStream(sessionId, turnId);
    const events: unknown[] = [];
    for await (const ev of stream.iterator) events.push(ev);
    const types = events.map((e) => (e as { type: string }).type);
    expect(types[0]).toBe("turn.created");
    expect(types).toContain("model.message.delta");
    expect(types[types.length - 1]).toBe("turn.done");
    // The deny path (and the second-allow path) also work.
    const { turnId: turnId2 } = await client.resumeTurnWithApproval({
      sessionId,
      threadId: "thr_resume2",
      toolCallId: "tc_resume2",
      decision: "deny",
      reason: "test",
    });
    const stream2 = await client.createTurnStream(sessionId, turnId2);
    const events2: unknown[] = [];
    for await (const ev of stream2.iterator) events2.push(ev);
    const types2 = events2.map((e) => (e as { type: string }).type);
    expect(types2[0]).toBe("turn.created");
    expect(types2[types2.length - 1]).toBe("turn.done");
  });
});
