// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { SaveCard, type SaveCardProps } from "../components/gates/save-card";

// Phase 4.3 — Save card contract (RED first).

afterEach(() => cleanup());

const baseProps: SaveCardProps = {
  gate: {
    id: "g-save",
    tool_name: "merge_annotations",
    status: "pending",
    expires_at: new Date(Date.now() + 300_000).toISOString(),
    payload: null,
  },
  annotations: [
    { id: "11111111-1111-1111-1111-111111111111", text: "Claim A warrants further investigation." },
    { id: "22222222-2222-2222-2222-222222222222", text: "Figure 3 caption seems inconsistent with the text." },
  ],
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

describe("Save card chrome + severity", () => {
  it("renders the severity badge as reversible", () => {
    const { getByTestId } = render(<SaveCard {...baseProps} />);
    expect(getByTestId("save-severity").textContent).toBe("reversible");
    expect(getByTestId("save-severity").getAttribute("data-severity")).toBe("reversible");
  });

  it("renders the annotation count in the header", () => {
    const { getByTestId } = render(<SaveCard {...baseProps} />);
    expect(getByTestId("save-count").textContent).toContain("2 annotations");
  });

  it("renders the countdown", () => {
    const { getByTestId } = render(<SaveCard {...baseProps} />);
    expect(getByTestId("save-countdown").textContent).toMatch(/expires in \d+:\d{2}/);
  });
});

describe("Save card annotation list", () => {
  it("renders one row per annotation with id and text", () => {
    const { getAllByTestId } = render(<SaveCard {...baseProps} />);
    const rows = getAllByTestId("save-annotation");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("11111111");
    expect(rows[0]?.textContent).toContain("Claim A");
    expect(rows[1]?.textContent).toContain("Figure 3");
  });

  it("renders an empty-state message when there is nothing to merge", () => {
    const { getByTestId } = render(<SaveCard {...baseProps} annotations={[]} />);
    // Design pass added an "Annotations to merge" heading inside the save-list
    // section; the empty-state copy still lives in the same testid.
    expect(getByTestId("save-list").textContent).toMatch(/Nothing to merge/);
  });
});

describe("Save card actions", () => {
  it("Allow calls onAllow; disabled after a decision", () => {
    const { getByTestId, rerender } = render(<SaveCard {...baseProps} />);
    fireEvent.click(getByTestId("save-allow"));
    expect(baseProps.onAllow).toHaveBeenCalledTimes(1);
    rerender(<SaveCard {...baseProps} gate={{ ...baseProps.gate, status: "allowed" }} />);
    expect((getByTestId("save-allow") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Deny calls onDeny with the prompted reason", () => {
    const { getByTestId } = render(<SaveCard {...baseProps} />);
    const prompt = vi.spyOn(window, "prompt").mockReturnValue("wait until tomorrow");
    fireEvent.click(getByTestId("save-deny"));
    expect(baseProps.onDeny).toHaveBeenCalledWith("wait until tomorrow");
    prompt.mockRestore();
  });
});

describe("Save card expiry", () => {
  it("shows the expiry copy when secondsRemaining hits 0", () => {
    const props = {
      ...baseProps,
      gate: { ...baseProps.gate, expires_at: new Date(Date.now() + 2000).toISOString() },
    };
    const { getByTestId } = render(<SaveCard {...props} />);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(getByTestId("save-expired").textContent).toMatch(/approval expired/i);
  });
});
