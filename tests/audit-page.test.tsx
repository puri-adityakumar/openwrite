// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

// Phase 5.2 — audit timeline mapping + render.
//
//   1. rowsFromLiveEvents maps the live `audit` jsonb events into the
//      mockup vocabulary (▶ session started, ✓ …, ⏸ Verify requested,
//      ✓ user allowed, ⏹ stopped/cap) preserving input (id ASC) order.
//   2. rowsFromSeedEvents renders seed_audits (trail pills + pulse)
//      into the SAME AuditRow shape — the parity surface.
//   3. auditFooter: Total tokens N · Cost — · Duration Mm Ss with the
//      "Cost —" rule (total_cost_in_usd === 0).
//   4. <AuditTimeline> renders rows + footer with stable test ids.

afterEach(() => cleanup());

const LIVE_EVENTS = [
  { id: "e1", createdAt: "2026-08-28T12:00:00.000Z", type: "turn.created", payload: { sessionId: "s", turnId: "t" } },
  { id: "e2", createdAt: "2026-08-28T12:00:01.000Z", type: "sandbox.created", payload: { sandboxId: "sbx_fresh1" } },
  { id: "e3", createdAt: "2026-08-28T12:00:02.000Z", type: "thread.created", payload: { threadId: "thr_s", title: "claims-section" } },
  { id: "e4", createdAt: "2026-08-28T12:00:03.000Z", type: "model.message.delta", payload: { delta: "noise" } },
  { id: "e5", createdAt: "2026-08-28T12:00:04.000Z", type: "tool.approval_required", payload: { toolName: "bash", threadId: "thr_v", toolCallId: "tc_v" } },
  { id: "e6", createdAt: "2026-08-28T12:00:05.000Z", type: "turn.done", payload: { state: "done", requiredActions: [{ type: "tool.approval" }], metrics: {} } },
  { id: "e7", createdAt: "2026-08-28T12:00:30.000Z", type: "gate.decision", payload: { decision: "allow" } },
  { id: "e8", createdAt: "2026-08-28T12:01:06.000Z", type: "halt.stop", payload: { reason: "user" } },
];

describe("rowsFromLiveEvents — mockup vocabulary", () => {
  it("maps the core event vocabulary in input order", async () => {
    const { rowsFromLiveEvents } = await import("../lib/audit-rows");
    const rows = rowsFromLiveEvents(LIVE_EVENTS);
    expect(rows.map((r) => r.message)).toEqual([
      "session started",
      "sandbox created: sbx_fresh1",
      "subagent: claims-section",
      "Verify requested",
      "turn paused on 1 gate(s)",
      "user allowed",
      "stopped by user",
    ]);
    expect(rows.map((r) => r.icon)).toEqual([
      "▶", "✓", "✓", "⏸", "⏸", "✓", "⏹",
    ]);
  });

  it("timestamps render as HH:MM:SS", async () => {
    const { rowsFromLiveEvents } = await import("../lib/audit-rows");
    const rows = rowsFromLiveEvents(LIVE_EVENTS);
    expect(rows[0]!.ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("cap.exceeded and denied decisions map to their vocabulary", async () => {
    const { rowsFromLiveEvents } = await import("../lib/audit-rows");
    const rows = rowsFromLiveEvents([
      { id: "c1", createdAt: "2026-08-28T12:00:00.000Z", type: "cap.exceeded", payload: { totalTokens: 18402 } },
      { id: "c2", createdAt: "2026-08-28T12:00:01.000Z", type: "gate.decision", payload: { decision: "deny", reason: "network mode unclear" } },
    ]);
    expect(rows[0]!.icon).toBe("⏹");
    expect(rows[0]!.message).toContain("cap exceeded");
    expect(rows[0]!.message).toContain("18,402");
    expect(rows[1]!.icon).toBe("✗");
    expect(rows[1]!.message).toContain("user denied");
    expect(rows[1]!.message).toContain("network mode unclear");
  });
});

describe("rowsFromSeedEvents — seed parity", () => {
  it("maps trail pills + pulse lines into the same AuditRow shape", async () => {
    const { rowsFromSeedEvents } = await import("../lib/audit-rows");
    const rows = rowsFromSeedEvents({
      trail: { pills: [{ id: "source", label: "Source", state: "done" }] },
      pulse: ["8 authors · 11 figures · 4 tables"],
    } as never);
    expect(rows).toEqual([
      { ts: "—", icon: "▶", message: "Source" },
      { ts: "—", icon: "✓", message: "8 authors · 11 figures · 4 tables" },
    ]);
  });
});

describe("auditFooter — totals line", () => {
  it("computes tokens, the Cost — rule, and Mm Ss duration", async () => {
    const { auditFooter } = await import("../lib/audit-rows");
    const events = [
      ...LIVE_EVENTS,
      { id: "e9", createdAt: "2026-08-28T12:01:06.000Z", type: "turn.done", payload: { state: "done", requiredActions: [], metrics: { totalTokens: 18402, totalCostInUsd: 0 } } },
    ];
    const footer = auditFooter(events);
    expect(footer).toBe("Total tokens 18,402  ·  Cost —  ·  Duration 1m 6s");
  });

  it("shows a real cost when the provider reports one (never for 0)", async () => {
    const { auditFooter } = await import("../lib/audit-rows");
    const footer = auditFooter([
      { id: "a", createdAt: "2026-08-28T12:00:00.000Z", type: "turn.created", payload: {} },
      { id: "b", createdAt: "2026-08-28T12:00:59.000Z", type: "turn.done", payload: { state: "done", requiredActions: [], metrics: { totalTokens: 500, totalCostInUsd: 0.012 } } },
    ]);
    expect(footer).toContain("Cost $0.012");
    expect(footer).toContain("Duration 59s");
  });

  it("renders placeholders when there is no metrics-carrying turn", async () => {
    const { auditFooter } = await import("../lib/audit-rows");
    expect(auditFooter([])).toBe("Total tokens —  ·  Cost —  ·  Duration —");
  });
});

describe("AuditTimeline component", () => {
  it("renders rows and the footer with stable test ids", async () => {
    const { AuditTimeline } = await import("../components/audit-timeline");
    const { getByTestId, getAllByTestId } = render(
      <AuditTimeline
        rows={[
          { ts: "18:04:12", icon: "▶", message: "session started" },
          { ts: "18:04:55", icon: "⏸", message: "Verify requested" },
        ]}
        footer="Total tokens 18,402  ·  Cost —  ·  Duration 1m 6s"
        actions={null}
      />,
    );
    expect(getByTestId("audit-timeline")).toBeTruthy();
    expect(getAllByTestId("audit-row")).toHaveLength(2);
    expect(getByTestId("audit-footer").textContent).toContain("Total tokens 18,402");
  });
});
