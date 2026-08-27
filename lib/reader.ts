// Phase 3.2 — Reader drawer viewport helper.
//
// Per Phase 3.2#2: 40/60 split on ≥1440 px; replaces the right column
// below 1440 px. The className is what CSS uses to choose layout; we
// pin the logic in a pure function so a refactor doesn't silently shift
// the breakpoint.

export const READER_SPLIT_MIN_WIDTH = 1440;

export function drawerClassForViewport(width: number): "reader-split" | "reader-replaces" {
  return width >= READER_SPLIT_MIN_WIDTH ? "reader-split" : "reader-replaces";
}
