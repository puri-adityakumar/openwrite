// Receipt stat — Fraunces display numeral with count-up tween.
// The wrapper <dt> holds the IntersectionObserver ref; when the
// element enters viewport, useCountUp tweens from 0 to `to`.
// aria-live="polite" on the parent <dl> announces only the final
// value (the count-up updates aria-hidden text, not the visible
// number) so screen readers don't read every intermediate value.

"use client";

import { useCountUp } from "../hooks/useCountUp";

type CounterStatProps = {
  to: number;
  caption: string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
};

export function CounterStat({
  to,
  caption,
  suffix = "",
  prefix = "",
  decimals = 0,
}: CounterStatProps) {
  const { ref, value } = useCountUp({ to, durationMs: 1100, decimals });
  const display =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  return (
    <>
      <dt
        ref={ref}
        className="rcp-display text-[var(--color-foreground)] leading-none"
        style={{ fontSize: "clamp(3rem, 6vw, 5.25rem)" }}
        aria-label={`${prefix}${to}${suffix} ${caption}`}
      >
        <span aria-hidden="true">
          {prefix}
          {display}
          {suffix}
        </span>
      </dt>
      <dd
        className="font-heading font-medium text-[0.75rem] uppercase tracking-[0.06em] self-center"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        {caption}
      </dd>
    </>
  );
}