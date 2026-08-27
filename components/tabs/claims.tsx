"use client";

// Phase 3.2 — Claims tab.
//
// Renders the paper's claims as a claim↔evidence table. Each row has
// a confidence chip; clicking a row opens the Reader at the claim's
// page anchor. The Reader is provided by the parent (Cockpit) as a
// controlled prop so the Cockpit can mount it once and reuse it
// across tab switches.

import type { Claim } from "../../lib/claims";

function confidenceTone(c: number | null): string {
  if (c === null) return "bg-[var(--panel-2)] text-[var(--muted)]";
  if (c >= 0.9) return "bg-[var(--good)] text-black";
  if (c >= 0.7) return "bg-[var(--warn)] text-black";
  return "bg-[var(--bad)] text-white";
}

export function Claims({
  claims,
  onOpenClaim,
}: {
  claims: Claim[];
  onOpenClaim: (claim: Claim) => void;
}) {
  if (claims.length === 0) {
    return (
      <div data-testid="claims-tab" className="text-sm text-[var(--muted)]">
        No claims extracted yet.
      </div>
    );
  }
  return (
    <table data-testid="claims-tab" className="w-full text-sm border-separate border-spacing-y-1">
      <thead>
        <tr className="text-left text-xs text-[var(--muted)]">
          <th className="px-2 py-1">Claim</th>
          <th className="px-2 py-1">Evidence</th>
          <th className="px-2 py-1">Page</th>
          <th className="px-2 py-1">Conf.</th>
        </tr>
      </thead>
      <tbody>
        {claims.map((c) => (
          <tr
            key={c.id}
            data-testid="claim-row"
            data-claim-id={c.id}
            onClick={() => onOpenClaim(c)}
            className="cursor-pointer bg-[var(--panel)] hover:bg-[var(--panel-2)] rounded"
          >
            <td className="px-2 py-2 align-top">{c.text}</td>
            <td className="px-2 py-2 align-top text-[var(--muted)]">{c.evidence}</td>
            <td className="px-2 py-2 align-top">{c.page ?? "—"}</td>
            <td className="px-2 py-2 align-top">
              <span
                data-testid="confidence-chip"
                className={"rounded-full px-2 py-0.5 text-xs " + confidenceTone(c.confidence)}
              >
                {c.confidence === null ? "—" : `${Math.round(c.confidence * 100)}%`}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
