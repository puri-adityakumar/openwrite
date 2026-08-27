// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { Pulse } from "../components/pulse";
import type { LiveState } from "../lib/event-reducer";

// Phase 3.1 — Pulse component contract (RED first).
//
// Pinned by docs/ui-mockups.md and the Phase 3 plan:
//   - exactly 5 lines
//   - monospace, HH:MM:SS [role] message format
//   - 15 s heartbeat line visible as a comment-style "hb" or similar
//   - role prefix from the server-mirrored ThreadMap (not parsed from text)

function makeStateWith(lines: string[]): LiveState {
  return {
    status: "running",
    seq: 100,
    coverage: [],
    pulse: lines,
    metrics: { totalTokens: 0, costDisplay: "—" },
    gates: [],
    sandboxId: null,
    lastDeltaMessageId: null,
    terminal: null,
  };
}

afterEach(() => cleanup());

describe("Pulse — 5-line cap", () => {
  it("renders at most 5 lines, taking the last 5 from the input", () => {
    const lines = [
      "10:00:00 [agent]    turn started",
      "10:00:01 [reader]   fetched §1",
      "10:00:02 [reader]   fetched §2",
      "10:00:03 [searcher] found 3 works",
      "10:00:04 [extractor] extracted 2 claims",
      "10:00:05 [verifier] proposing Verify gate",
      "10:00:06 [verifier] reproduced 91.7%",
    ];
    // No heartbeat here — the 5-line cap is the event budget.
    const { container } = render(<Pulse state={makeStateWith(lines)} lastHeartbeat={null} />);
    const items = container.querySelectorAll('[data-testid="pulse-line"]');
    expect(items.length).toBe(5);
    // The last 5 input lines should be the first 5 rendered (newest at bottom).
    expect(items[0]?.textContent).toContain("10:00:02");
    expect(items[4]?.textContent).toContain("10:00:06");
  });

  it("renders fewer than 5 lines when the input has fewer than 5", () => {
    const lines = ["10:00:00 [agent]    turn started"];
    const { container } = render(<Pulse state={makeStateWith(lines)} lastHeartbeat={null} />);
    const items = container.querySelectorAll('[data-testid="pulse-line"]');
    expect(items.length).toBe(1);
  });

  it("Qodo #5: heartbeat takes one of the 5 slots (5 events + hb = 5 total)", () => {
    const lines = [
      "10:00:00 [agent]    turn started",
      "10:00:01 [reader]   fetched §1",
      "10:00:02 [reader]   fetched §2",
      "10:00:03 [searcher] found 3 works",
      "10:00:04 [extractor] extracted 2 claims",
    ];
    const { container } = render(<Pulse state={makeStateWith(lines)} lastHeartbeat="10:00:15" />);
    const items = container.querySelectorAll('[data-testid="pulse-line"]');
    const hb = container.querySelector('[data-testid="pulse-heartbeat"]');
    // Heartbeat reserves a slot: 4 event lines + 1 hb = 5 total.
    expect(items.length).toBe(4);
    expect(hb).not.toBeNull();
    expect(container.querySelector('[data-testid="pulse"]')?.getAttribute("data-line-count")).toBe("5");
  });

  it("Qodo #5: 7 events + hb shows only the last 4 events + hb", () => {
    const lines = [
      "10:00:00 [agent]    turn started",
      "10:00:01 [reader]   fetched §1",
      "10:00:02 [reader]   fetched §2",
      "10:00:03 [searcher] found 3 works",
      "10:00:04 [extractor] extracted 2 claims",
      "10:00:05 [verifier] proposing Verify gate",
      "10:00:06 [verifier] reproduced 91.7%",
    ];
    const { container } = render(<Pulse state={makeStateWith(lines)} lastHeartbeat="10:00:15" />);
    const items = container.querySelectorAll('[data-testid="pulse-line"]');
    expect(items.length).toBe(4);
    expect(items[0]?.textContent).toContain("10:00:03");
    expect(items[3]?.textContent).toContain("10:00:06");
    expect(container.querySelector('[data-testid="pulse"]')?.getAttribute("data-line-count")).toBe("5");
  });
});

describe("Pulse — role prefix format", () => {
  it("each line keeps its `[role]` prefix verbatim", () => {
    const lines = [
      "10:00:00 [agent]    turn started",
      "10:00:01 [reader]   fetched §1",
      "10:00:02 [searcher] found 3 works",
    ];
    const { container } = render(<Pulse state={makeStateWith(lines)} lastHeartbeat={null} />);
    const items = container.querySelectorAll('[data-testid="pulse-line"]');
    expect(items[0]?.textContent).toMatch(/\[agent\]/);
    expect(items[1]?.textContent).toMatch(/\[reader\]/);
    expect(items[2]?.textContent).toMatch(/\[searcher\]/);
  });
});

describe("Pulse — heartbeat", () => {
  it("renders a heartbeat line at the bottom when lastHeartbeat is set", () => {
    const lines = ["10:00:00 [agent]    turn started"];
    const { container } = render(
      <Pulse state={makeStateWith(lines)} lastHeartbeat="10:00:15" />,
    );
    const hb = container.querySelector('[data-testid="pulse-heartbeat"]');
    expect(hb).not.toBeNull();
    expect(hb?.textContent).toContain("10:00:15");
    expect(hb?.textContent).toMatch(/hb|heartbeat|·/i);
  });

  it("does not render a heartbeat when lastHeartbeat is null", () => {
    const lines = ["10:00:00 [agent]    turn started"];
    const { container } = render(<Pulse state={makeStateWith(lines)} lastHeartbeat={null} />);
    const hb = container.querySelector('[data-testid="pulse-heartbeat"]');
    expect(hb).toBeNull();
  });
});
