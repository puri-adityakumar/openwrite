// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";

// Phase 6.3 — Tour modal (RED first).
//
// The floating "ⓘ How it works" button opens a 7-slide modal over the
// current page: one screenshot per surface, prev/next + close, Escape
// dismisses. The demo script expects the floating button hovering on
// the dashboard.

afterEach(() => cleanup());

describe("Tour — floating button + 7-slide modal", () => {
  it("shows the floating ⓘ button and opens the modal with 7 slides", async () => {
    const { Tour } = await import("../components/tour");
    const { getByTestId, getAllByTestId, queryByTestId } = render(<Tour />);
    // Modal is closed until the button is pressed.
    expect(queryByTestId("tour-modal")).toBeNull();
    fireEvent.click(getByTestId("tour-open"));
    const modal = getByTestId("tour-modal");
    expect(modal).toBeTruthy();
    expect(getAllByTestId("tour-slide")).toHaveLength(7);
  });

  it("navigates prev/next and closes; Escape dismisses", async () => {
    const { Tour } = await import("../components/tour");
    const { getByTestId, queryByTestId, container } = render(<Tour />);
    fireEvent.click(getByTestId("tour-open"));
    const next = getByTestId("tour-next");
    const prev = getByTestId("tour-prev");

    // Prev is a no-op on the first slide; Next advances the counter.
    expect(getByTestId("tour-counter").textContent).toContain("1 / 7");
    fireEvent.click(prev);
    expect(getByTestId("tour-counter").textContent).toContain("1 / 7");
    fireEvent.click(next);
    expect(getByTestId("tour-counter").textContent).toContain("2 / 7");

    fireEvent.click(getByTestId("tour-close"));
    expect(queryByTestId("tour-modal")).toBeNull();

    // Re-open, then Escape dismisses too.
    fireEvent.click(getByTestId("tour-open"));
    fireEvent.keyDown(container, { key: "Escape" });
    expect(queryByTestId("tour-modal")).toBeNull();
  });
});

describe("Tour — modal accessibility (Qodo review #5, #6)", () => {
  it("the dialog is labelled by its visible heading", async () => {
    const { Tour } = await import("../components/tour");
    const { getByTestId } = render(<Tour />);
    fireEvent.click(getByTestId("tour-open"));
    const modal = getByTestId("tour-modal");
    const labelledBy = modal.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toContain("How Recap works");
  });

  it("moves focus into the modal on open, traps Tab, and restores it on close", async () => {
    const { Tour } = await import("../components/tour");
    const { getByTestId } = render(<Tour />);
    const opener = getByTestId("tour-open");
    fireEvent.click(opener);
    // Focus moved into the dialog (the close button is the first control).
    const modal = getByTestId("tour-modal");
    expect(modal.contains(document.activeElement)).toBe(true);
    // Tab on the last control wraps back inside the dialog.
    const next = getByTestId("tour-next");
    next.focus();
    fireEvent.keyDown(modal, { key: "Tab" });
    expect(modal.contains(document.activeElement)).toBe(true);
    // Close restores focus to the opener.
    fireEvent.click(getByTestId("tour-close"));
    expect(document.activeElement).toBe(opener);
  });
});
