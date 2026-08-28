// Phase 5.1 — per-paper budget cap guard (PURE module: importable from
// client components — no db imports here; the stream-side enforcement
// lives in lib/cap-server.ts).
//
// A paper may carry a cost cap (USD) and/or a token cap. The cost cap
// governs when the provider reports a real cost; the custom provider
// reports total_cost_in_usd === 0, so there the "Cost —" rule applies
// and the token cap is the effective guard (architecture.md).

export type Cap = { capUsd: number | null; capTokens: number | null };
export type CapUsage = { totalTokens: number; totalCostInUsd: number };

export function capExceeded(cap: Cap, usage: CapUsage): boolean {
  if (cap.capUsd != null && usage.totalCostInUsd > 0 && usage.totalCostInUsd >= Number(cap.capUsd)) {
    return true;
  }
  if (cap.capTokens != null && usage.totalTokens >= cap.capTokens) return true;
  return false;
}

export type CapChipState = { active: boolean; exceeded: boolean; label: string };

// Pure chip state for the status row. The label shows the usage the
// operator is guarding against: the cost display when a real cost
// flows (never "$0.00" — "—" stays "—"), otherwise the token count.
export function capChip(
  cap: Cap,
  disp: { totalTokens: number; costDisplay: string },
): CapChipState {
  if (cap.capUsd == null && cap.capTokens == null) {
    return { active: false, exceeded: false, label: "—" };
  }
  const costUsd = disp.costDisplay === "—" ? 0 : Number(disp.costDisplay.replace("$", ""));
  const exceeded = capExceeded(cap, { totalTokens: disp.totalTokens, totalCostInUsd: costUsd });
  const label =
    cap.capUsd != null && costUsd > 0 ? disp.costDisplay : `${disp.totalTokens.toLocaleString("en-US")} tok`;
  return { active: true, exceeded, label };
}
