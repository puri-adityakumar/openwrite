"use client";

// Phase 5.1 — the Cap chip. Shows the usage the operator is guarding
// (cost display, or token count under the "Cost —" rule) and turns
// red when the run's usage crosses the configured cap. With no cap
// configured it stays the plain "Cap: —" chip.

import { capChip } from "../lib/cap";

export function CapChip({
  capUsd,
  capTokens,
  totalTokens,
  costDisplay,
}: {
  capUsd: number | null;
  capTokens: number | null;
  totalTokens: number;
  costDisplay: string;
}) {
  const chip = capChip({ capUsd, capTokens }, { totalTokens, costDisplay });
  const tone = chip.exceeded
    ? "border-[var(--bad)] text-[var(--bad)]"
    : "border-[var(--border)] text-[var(--muted)]";
  return (
    <span
      className={`rounded border px-2 py-1 ${tone}`}
      data-testid="cap-chip"
      data-exceeded={chip.exceeded ? "true" : "false"}
      title={chip.active ? "Budget cap guard" : "No cap configured"}
    >
      Cap: {chip.label}
    </span>
  );
}
