"use client";

import { useEffect, useRef, useState } from "react";
import { capChip } from "../lib/cap";
import { Pill } from "./Pill";

// Budget guard chip. When no cap is configured there is nothing to
// guard — the chip renders nothing instead of a meaningless "Cap: —".

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
  const tone = chip.exceeded ? "bad" : "idle";

  // When the chip transitions to exceeded, surface that change to
  // assistive tech. The pill is a status badge — the announcement
  // happens once, on the transition, not on every render.
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const prevExceeded = useRef(chip.exceeded);
  useEffect(() => {
    if (chip.exceeded && !prevExceeded.current) {
      setAnnouncement(`Budget cap exceeded at ${chip.label}.`);
    } else if (!chip.exceeded && prevExceeded.current) {
      setAnnouncement("Budget cap back under threshold.");
    }
    prevExceeded.current = chip.exceeded;
  }, [chip.exceeded, chip.label]);

  if (!chip.active) return null;

  return (
    <>
      <Pill
        tone={tone}
        data-testid="cap-chip"
        data-exceeded={chip.exceeded ? "true" : "false"}
        title={chip.exceeded ? "Budget cap exceeded — the run stopped" : "Budget cap — the run stops here if usage crosses it"}
        style={
          chip.exceeded
            ? { borderColor: "var(--color-destructive)", color: "var(--color-destructive)" }
            : undefined
        }
      >
        Cap {chip.label}
      </Pill>
      {/* Live region — read by screen readers on transition. Visually
          hidden, semantically live, polite. */}
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
