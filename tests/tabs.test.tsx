// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { Tabs } from "../components/tabs";

// Phase 3.1 — Tabs component contract (RED first).
//
// Pinned by docs/ui-mockups.md:
//   - 4 tabs: Summary (default) · Claims · Authors · Audit
//   - Audit tab is a link to /paper/:slug/audit (Phase 5 wires the live
//     audit table; in Phase 3 the link is just a router push)
//   - Switching tabs re-renders the panel without remounting the cockpit
//   - Tab state is controlled by the parent (LiveCockpit) so the cockpit
//     can pass a default for live vs seed

afterEach(() => cleanup());

describe("Tabs — default + switch", () => {
  it("renders the 4 tab buttons in the locked order", () => {
    render(
      <Tabs
        slug="attention-is-all-you-need"
        active="summary"
        onChange={() => {}}
        panels={{
          summary: <div>summary panel</div>,
          claims: <div>claims panel</div>,
          authors: <div>authors panel</div>,
          audit: <div>audit panel</div>,
        }}
      />,
    );
    const buttons = screen.getAllByRole("tab");
    expect(buttons.map((b) => b.textContent)).toEqual(["Summary", "Claims", "Authors", "Audit"]);
  });

  it("shows the active panel only", () => {
    render(
      <Tabs
        slug="x"
        active="claims"
        onChange={() => {}}
        panels={{
          summary: <div>summary panel</div>,
          claims: <div>claims panel</div>,
          authors: <div>authors panel</div>,
          audit: <div>audit panel</div>,
        }}
      />,
    );
    expect(screen.getByText("claims panel")).toBeTruthy();
    expect(screen.queryByText("summary panel")).toBeNull();
    expect(screen.queryByText("authors panel")).toBeNull();
    expect(screen.queryByText("audit panel")).toBeNull();
  });

  it("calls onChange with the new tab id when a tab is clicked", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        slug="x"
        active="summary"
        onChange={onChange}
        panels={{
          summary: <div>summary panel</div>,
          claims: <div>claims panel</div>,
          authors: <div>authors panel</div>,
          audit: <div>audit panel</div>,
        }}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Authors" }));
    expect(onChange).toHaveBeenCalledWith("authors");
  });

  it("Audit tab is a link to /paper/:slug/audit (uses <a href>)", () => {
    render(
      <Tabs
        slug="attention-is-all-you-need"
        active="summary"
        onChange={() => {}}
        panels={{
          summary: <div>summary panel</div>,
          claims: <div>claims panel</div>,
          authors: <div>authors panel</div>,
          audit: <div>audit panel</div>,
        }}
      />,
    );
    const audit = screen.getByRole("tab", { name: "Audit" });
    expect(audit.tagName).toBe("A");
    expect(audit.getAttribute("href")).toBe("/paper/attention-is-all-you-need/audit");
  });
});
