import { describe, it, expect } from "vitest";
import { drawerClassForViewport } from "../lib/reader";

// Phase 3.2 — Reader drawer breakpoint (RED first).
//
// Per Phase 3.2#2: 40/60 split on ≥1440 px; replaces the right column
// below 1440 px. The className is what CSS uses to choose layout; we
// pin the logic here so a refactor doesn't silently shift the breakpoint.

describe("drawerClassForViewport", () => {
  it("returns split-layout class at 1440 px and above", () => {
    expect(drawerClassForViewport(1440)).toBe("reader-split");
    expect(drawerClassForViewport(1920)).toBe("reader-split");
  });

  it("returns replaces-column class below 1440 px", () => {
    expect(drawerClassForViewport(1439)).toBe("reader-replaces");
    expect(drawerClassForViewport(1024)).toBe("reader-replaces");
    expect(drawerClassForViewport(768)).toBe("reader-replaces");
  });
});
