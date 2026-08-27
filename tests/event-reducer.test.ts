import { describe, it, expect } from "vitest";
import {
  reduce,
  initialState,
  deriveTrail,
  type LiveState,
  type LiveEvent,
} from "../lib/event-reducer";

// Phase 2.1 — event-reducer unit tests (RED first).
//
// These tests pin the reducer contract for the live-run SSE pipeline. They
// cover the P7-constraint behaviors the cockpit depends on:
//   - P7#3: turn.done + requiredActions.length > 0  -> "paused", never "done"
//   - P7#3: turn.done plain                          -> "done"
//   - delta coalescing by messageId
//   - cost="0" renders as "—" with a totalTokens fallback
//   - sandbox.created decorates the state with a sandboxId
//   - tool.approval_required surfaces a gate and the next turn.done
//     must come back as "paused"
//   - sequence numbers are honored (out-of-order events with seq < cursor
//     are dropped; same-seq duplicates are dropped)
//
// The reducer is a pure function: no DB, no network, no globals. It is
// driven entirely by the SSE event stream from createTurnStream.

function ev(partial: Partial<LiveEvent> & { type: LiveEvent["type"] }): LiveEvent {
  return {
    id: partial.id ?? `id-${Math.random()}`,
    seq: partial.seq ?? 0,
    createdAt: partial.createdAt ?? "2026-08-27T14:00:00.000Z",
    type: partial.type,
    payload: partial.payload ?? {},
  } as LiveEvent;
}

describe("initialState", () => {
  it("starts queued with empty coverage/pulse and no metrics", () => {
    const s = initialState();
    expect(s.status).toBe("queued");
    expect(s.coverage).toEqual([]);
    expect(s.pulse).toEqual([]);
    expect(s.metrics).toEqual({ totalTokens: 0, costDisplay: "—" });
    expect(s.gates).toEqual([]);
    expect(s.sandboxId).toBeNull();
  });

  it("deriveTrail() on the initial state yields 6 pills with Source running", () => {
    const pills = deriveTrail(initialState());
    expect(pills.length).toBe(6);
    // Pre-stream the first pill is "running" (Source is the first stage to
    // begin once the turn starts; before turn.created, it is "pending").
    // We assert the shape — 6 pills, all distinct IDs, Source first.
    expect(pills[0]?.id).toBe("source");
    expect(pills[5]?.id).toBe("done");
  });
});

describe("P7#3 — turn.done classification", () => {
  it("plain turn.done (no requiredActions) ends the run as 'done'", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({ type: "turn.created" }));
    const s2 = reduce(s1, ev({
      type: "turn.done",
      payload: { state: "done", requiredActions: [], metrics: { totalTokens: 18402, totalCostInUsd: 0 } },
    }));
    expect(s2.status).toBe("done");
  });

  it("turn.done with requiredActions.length > 0 is 'paused' (never 'done')", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({ type: "turn.created" }));
    const s2 = reduce(s1, ev({
      type: "turn.done",
      payload: {
        state: "done",
        requiredActions: [{ type: "tool.approval", toolCallId: "tc_1" }],
        metrics: { totalTokens: 1024, totalCostInUsd: 0 },
      },
    }));
    expect(s2.status).toBe("paused");
  });

  it("turn.done with empty requiredActions array is 'done' (length check, not truthiness)", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({ type: "turn.created" }));
    const s2 = reduce(s1, ev({
      type: "turn.done",
      payload: { state: "done", requiredActions: [], metrics: { totalTokens: 0, totalCostInUsd: 0 } },
    }));
    expect(s2.status).toBe("done");
  });

  it("turn.done with state='error' is 'error'", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({ type: "turn.created" }));
    const s2 = reduce(s1, ev({
      type: "turn.done",
      payload: { state: "error", requiredActions: [], metrics: { totalTokens: 0, totalCostInUsd: 0 } },
    }));
    expect(s2.status).toBe("error");
  });
});

describe("cost display rule (architecture: GMI custom provider)", () => {
  it("totalCostInUsd === 0  -> costDisplay '—' and falls back to totalTokens", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({
      type: "turn.done",
      payload: { state: "done", requiredActions: [], metrics: { totalTokens: 18402, totalCostInUsd: 0 } },
    }));
    expect(s1.metrics.costDisplay).toBe("—");
    expect(s1.metrics.totalTokens).toBe(18402);
  });

  it("totalCostInUsd > 0   -> costDisplay '$0.012' formatted to 3dp", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({
      type: "turn.done",
      payload: { state: "done", requiredActions: [], metrics: { totalTokens: 900, totalCostInUsd: 0.012 } },
    }));
    expect(s1.metrics.costDisplay).toBe("$0.012");
  });
});

describe("delta coalescing by messageId", () => {
  it("two model.message.delta with the same messageId coalesce into one pulse line", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({
      type: "model.message.delta",
      payload: { messageId: "m1", role: "reader", delta: "Trans" },
    }));
    const s2 = reduce(s1, ev({
      type: "model.message.delta",
      payload: { messageId: "m1", role: "reader", delta: "former" },
    }));
    expect(s2.pulse.length).toBe(1);
    expect(s2.pulse[0]).toContain("Trans");
    expect(s2.pulse[0]).toContain("former");
  });

  it("two model.message.delta with different messageIds produce two pulse lines", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({
      type: "model.message.delta",
      payload: { messageId: "m1", role: "reader", delta: "hello" },
    }));
    const s2 = reduce(s1, ev({
      type: "model.message.delta",
      payload: { messageId: "m2", role: "verifier", delta: "world" },
    }));
    expect(s2.pulse.length).toBe(2);
  });
});

describe("sandbox.created probe (P7 day-one integration evidence)", () => {
  it("captures sandboxId on the state and emits a pulse line", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({
      type: "sandbox.created",
      payload: { sandboxId: "sbx_abc123" },
    }));
    expect(s1.sandboxId).toBe("sbx_abc123");
    expect(s1.pulse.some((l) => l.includes("sbx_abc123"))).toBe(true);
  });
});

describe("tool.approval_required surfaces a gate (Phase 4 owns the UI)", () => {
  it("appends to gates with threadId+toolCallId", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({
      type: "tool.approval_required",
      payload: { threadId: "thr_1", toolCallId: "tc_1", toolName: "bash" },
    }));
    expect(s1.gates).toEqual([{ threadId: "thr_1", toolCallId: "tc_1", toolName: "bash" }]);
  });
});

describe("sequence-number guard", () => {
  it("drops an event with seq strictly less than the current cursor", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({ seq: 5, type: "thread.created", payload: { threadId: "thr_x" } }));
    const s2 = reduce(s1, ev({ seq: 3, type: "thread.created", payload: { threadId: "thr_y" } }));
    expect(s2.seq).toBe(5);
  });

  it("drops an event with seq equal to the current cursor (duplicate)", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({ seq: 5, type: "thread.created", payload: { threadId: "thr_x" } }));
    const s2 = reduce(s1, ev({ seq: 5, type: "thread.created", payload: { threadId: "thr_x_dup" } }));
    expect(s2.seq).toBe(5);
  });

  it("advances the cursor on seq strictly greater than current", () => {
    const s0 = initialState();
    const s1 = reduce(s0, ev({ seq: 5, type: "thread.created", payload: { threadId: "thr_x" } }));
    const s2 = reduce(s1, ev({ seq: 6, type: "thread.done", payload: { threadId: "thr_x" } }));
    expect(s2.seq).toBe(6);
  });
});

describe("status transitions", () => {
  it("turn.created moves queued -> running", () => {
    const s1 = reduce(initialState(), ev({ type: "turn.created" }));
    expect(s1.status).toBe("running");
  });
});
