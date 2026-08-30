"use client";

import type { Claim } from "../../lib/claims";

function confidenceTone(c: number | null): "good" | "warn" | "bad" | "idle" {
  if (c === null) return "idle";
  if (c >= 0.9) return "good";
  if (c >= 0.7) return "warn";
  return "bad";
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
      <div data-testid="claims-tab" className="claims-note">
        No claims extracted yet — they appear here as the agent reads the paper.
      </div>
    );
  }
  return (
    <div data-testid="claims-tab" className="card" style={{ padding: 0 }}>
      <table className="w-full text-sm border-separate border-spacing-y-0">
        <thead>
          <tr className="text-left text-xs text-[var(--color-muted-foreground)]">
            <th className="px-3 py-2 font-normal">Claim</th>
            <th className="px-3 py-2 font-normal">Evidence</th>
            <th className="px-3 py-2 font-normal">Page</th>
            <th className="px-3 py-2 font-normal">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((c) => {
            const tone = confidenceTone(c.confidence);
            return (
              <tr
                key={c.id}
                data-testid="claim-row"
                data-claim-id={c.id}
                onClick={() => onOpenClaim(c)}
                className="cursor-pointer bg-[var(--color-card)] hover:bg-[var(--color-secondary)]"
              >
                <td className="px-3 py-2.5 align-top text-[var(--color-foreground)]">{c.text}</td>
                <td className="px-3 py-2.5 align-top text-[var(--color-muted-foreground)]">{c.evidence}</td>
                <td className="px-3 py-2.5 align-top claims-page">{c.page ?? "—"}</td>
                <td className="px-3 py-2.5 align-top">
                  <span
                    data-testid="confidence-chip"
                    className="pill"
                    style={
                      tone === "good" ? { background: "var(--good)", color: "black", borderColor: "var(--good)" } :
                      tone === "warn" ? { background: "var(--warn)", color: "black", borderColor: "var(--warn)" } :
                      tone === "bad"  ? { background: "var(--color-destructive)", color: "var(--color-destructive-foreground)", borderColor: "var(--color-destructive)" } :
                      {}
                    }
                  >
                    {c.confidence === null ? "—" : `${Math.round(c.confidence * 100)}%`}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="claims-note px-3 py-2.5 border-t border-[var(--color-border)]">
        Click a claim to see it next to the page it came from.
      </p>
    </div>
  );
}
