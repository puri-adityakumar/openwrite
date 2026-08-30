// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Pulse, toPulseEntry } from "../components/pulse";
import type { LiveState } from "../lib/event-reducer";

// Pulse component contract — the run log as a chat feed:
//   - stamped event lines render as compact activity rows with the
//     literal `[role]` chip preserved
//   - tool responses (`tool -> ok`) render as tool chip rows
//   - model prose (`<messageId>: <markdown>`) renders as ONE chat
//     bubble with the markdown subset rendered (headings, bold, fences)
//     and the messageId dropped
//   - heartbeat renders as its own row at the bottom
//   - seed-style untimestamped lines render as activity rows verbatim

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

describe("Pulse — line classification", () => {
  it("classifies stamped events, tool responses, and model prose", () => {
    expect(toPulseEntry("10:00:00 [agent]    turn started")).toMatchObject({
      kind: "activity",
      role: "agent",
      text: "turn started",
    });
    expect(toPulseEntry("10:00:01 [agent]    tool -> ok")).toMatchObject({
      kind: "tool",
      name: "tool",
      outcome: "ok",
    });
    expect(
      toPulseEntry("10:00:02 [gate]     bash (call_1) awaiting approval"),
    ).toMatchObject({ kind: "activity", role: "gate" });
    expect(toPulseEntry("10:00:03 [agent]    subagent: repro worker")).toMatchObject({
      kind: "activity",
    });
    expect(toPulseEntry("10:00:04 [sandbox]  sbx_123 (fresh)")).toMatchObject({
      kind: "activity",
      role: "sandbox",
    });
  });

  it("extracts the markdown body and drops the messageId from model prose", () => {
    const entry = toPulseEntry(
      "10:00:05 [agent]    01m19v23w1rjcqst: ## Unable to complete\n\nThe download failed.",
    );
    expect(entry.kind).toBe("message");
    expect((entry as { text: string }).text).toBe(
      "## Unable to complete\n\nThe download failed.",
    );
  });

  it("keeps seed-style untimestamped lines verbatim as activity", () => {
    expect(toPulseEntry("8 authors · 11 figures · 4 tables")).toEqual({
      kind: "activity",
      time: "",
      role: "agent",
      text: "8 authors · 11 figures · 4 tables",
    });
  });
});

describe("Pulse — chat feed rendering", () => {
  it("renders stamped events as compact rows with role chips verbatim", () => {
    const lines = [
      "10:00:00 [agent]    turn started",
      "10:00:01 [reader]   fetched §1",
      "10:00:02 [searcher] found 3 works",
    ];
    const { container } = render(<Pulse state={makeStateWith(lines)} lastHeartbeat={null} />);
    const rows = container.querySelectorAll('[data-testid="pulse-line"]');
    expect(rows.length).toBe(3);
    expect(rows[0]?.textContent).toContain("[agent]");
    expect(rows[0]?.textContent).toContain("turn started");
    expect(rows[1]?.textContent).toMatch(/\[reader\]/);
    expect(rows[2]?.textContent).toMatch(/\[searcher\]/);
  });

  it("renders a model message as one bubble with markdown headings and bold", () => {
    const { container } = render(
      <Pulse
        state={makeStateWith([
          "10:00:00 [agent]    01m19v23w1rjcqst: ## Unable to complete\n\n**Tool limitations:** no web-fetch tool.",
        ])}
        lastHeartbeat={null}
      />,
    );
    const msg = container.querySelector('[data-kind="message"]');
    expect(msg).not.toBeNull();
    expect(msg?.querySelector("h3")?.textContent).toBe("Unable to complete");
    expect(msg?.querySelector("strong")?.textContent).toBe("Tool limitations:");
    // The raw messageId must NOT leak into the bubble.
    expect(msg?.textContent).not.toContain("01m19v23w1rjcqst");
  });

  it("renders fenced code blocks as pre/code", () => {
    const { container } = render(
      <Pulse
        state={makeStateWith([
          "10:00:00 [agent]    01m19v2abcdef: Run this:\n```bash\ncurl -L -o paper.pdf https://arxiv.org/pdf/2608.05446\n```",
        ])}
        lastHeartbeat={null}
      />,
    );
    const pre = container.querySelector("pre.md-pre code");
    expect(pre?.textContent).toContain("curl -L -o paper.pdf");
  });

  it("renders tool responses as chip rows with the outcome", () => {
    const { container } = render(
      <Pulse state={makeStateWith(["10:00:00 [agent]    tool -> ok"])} lastHeartbeat={null} />,
    );
    const row = container.querySelector('[data-kind="tool"]');
    expect(row?.textContent).toContain("tool");
    expect(row?.textContent).toContain("ok");
  });

  it("shows the empty state when there are no events and no heartbeat", () => {
    const { container } = render(<Pulse state={makeStateWith([])} lastHeartbeat={null} />);
    expect(container.querySelector('[data-testid="pulse-empty"]')).not.toBeNull();
  });

  it("exposes the visible entry count on the feed container", () => {
    const lines = ["10:00:00 [agent]    turn started", "10:00:01 [agent]    tool -> ok"];
    const { container } = render(<Pulse state={makeStateWith(lines)} lastHeartbeat={null} />);
    expect(container.querySelector('[data-testid="pulse"]')?.getAttribute("data-line-count")).toBe("2");
  });
});

describe("Pulse — heartbeat", () => {
  it("renders a heartbeat row at the bottom when lastHeartbeat is set", () => {
    const { container } = render(
      <Pulse state={makeStateWith(["10:00:00 [agent]    turn started"])} lastHeartbeat="10:00:15" />,
    );
    const hb = container.querySelector('[data-testid="pulse-heartbeat"]');
    expect(hb).not.toBeNull();
    expect(hb?.textContent).toContain("10:00:15");
    expect(hb?.textContent).toMatch(/hb|heartbeat|·/i);
  });

  it("does not render a heartbeat when lastHeartbeat is null", () => {
    const { container } = render(
      <Pulse state={makeStateWith(["10:00:00 [agent]    turn started"])} lastHeartbeat={null} />,
    );
    expect(container.querySelector('[data-testid="pulse-heartbeat"]')).toBeNull();
  });
});
