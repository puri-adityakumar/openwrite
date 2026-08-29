// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { PublishCard, type PublishCardProps } from "../components/gates/publish-card";

// Phase 4.3 — Publish card contract (RED first).

afterEach(() => cleanup());

const baseProps: PublishCardProps = {
  gate: {
    id: "g-pub",
    tool_name: "publish_review",
    status: "pending",
    expires_at: new Date(Date.now() + 300_000).toISOString(),
    payload: { before: 92.4, after: 91.7 },
  },
  before: { label: "Claimed", value: "92.4" },
  after: { label: "Reproduced", value: "91.7" },
  exportPath: "/paper/attention-is-all-you-need/export",
  onAllow: vi.fn(),
  onDeny: vi.fn(),
};

beforeEach(() => {
  vi.useFakeTimers();
  baseProps.onAllow = vi.fn();
  baseProps.onDeny = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Publish card chrome + diff", () => {
  it("renders the severity badge as irreversible and the countdown", () => {
    const { getByTestId } = render(<PublishCard {...baseProps} />);
    expect(getByTestId("publish-severity").textContent).toBe("irreversible");
    expect(getByTestId("publish-severity").getAttribute("data-severity")).toBe("irreversible");
    expect(getByTestId("publish-countdown").textContent).toMatch(/expires in \d+:\d{2}/);
  });

  it("renders the before / after diff and the Δ line", () => {
    const { getByTestId } = render(<PublishCard {...baseProps} />);
    expect(getByTestId("publish-before").textContent).toContain("92.4");
    expect(getByTestId("publish-after").textContent).toContain("91.7");
    expect(getByTestId("publish-delta").textContent).toMatch(/Δ -0\.7/);
  });

  it("renders the export path so the user can see what Allow unlocks", () => {
    const { getByTestId } = render(<PublishCard {...baseProps} />);
    expect(getByTestId("publish-export").textContent).toContain("/paper/attention-is-all-you-need/export");
  });
});

describe("Publish card actions", () => {
  it("Allow calls onAllow and is disabled after a decision", () => {
    const { getByTestId, rerender } = render(<PublishCard {...baseProps} />);
    fireEvent.click(getByTestId("publish-allow"));
    expect(baseProps.onAllow).toHaveBeenCalledTimes(1);
    rerender(<PublishCard {...baseProps} gate={{ ...baseProps.gate, status: "allowed" }} />);
    expect((getByTestId("publish-allow") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Deny calls onDeny with the prompted reason", () => {
    const { getByTestId } = render(<PublishCard {...baseProps} />);
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("diff too large");
    fireEvent.click(getByTestId("publish-deny"));
    expect(baseProps.onDeny).toHaveBeenCalledWith("diff too large");
    prompt.mockRestore();
  });
});

describe("Publish card expiry", () => {
  it("shows the expiry copy when secondsRemaining hits 0", () => {
    const props = {
      ...baseProps,
      gate: { ...baseProps.gate, expires_at: new Date(Date.now() + 2000).toISOString() },
    };
    const { getByTestId } = render(<PublishCard {...props} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(getByTestId("publish-expired").textContent).toMatch(/approval expired/i);
  });
});
