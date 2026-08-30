// Verify-gate interactive mock — radial "hold to allow" progress.
// On hover/focus/pointerdown, the ring fills from 0 to 100 over 3
// seconds. Releasing before complete resets to 0.
//
// Single aria-valuenow track on a role="progressbar"; the label
// cycles "Type the repo owner" → "Allowing… Xs" → "Allowed".

"use client";

import { useEffect, useRef, useState } from "react";

type HoldToAllowProps = {
  durationMs?: number;
  label?: string;
  hint?: string;
};

export function HoldToAllow({
  durationMs = 3000,
  label = "Allow",
  hint = "Hold for 3s",
}: HoldToAllowProps) {
  const [progress, setProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!holding) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
      if (!allowed) setProgress(0);
      return;
    }
    if (allowed) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setProgress(1);
      setAllowed(true);
      return;
    }

    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = now - startRef.current;
      const p = Math.min(elapsed / durationMs, 1);
      setProgress(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        setAllowed(true);
        setHolding(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [holding, allowed, durationMs]);

  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const elapsedSec = (progress * durationMs) / 1000;

  const liveLabel = allowed
    ? "Allowed"
    : holding
      ? `Allowing ${elapsedSec.toFixed(1)} seconds`
      : "Type the repo owner";

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        aria-label={liveLabel}
        aria-pressed={holding}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onPointerDown={() => !allowed && setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !allowed) {
            e.preventDefault();
            setHolding(true);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") setHolding(false);
        }}
        className="relative grid place-items-center w-14 h-14 rounded-full border border-[var(--color-foreground)]/30 focus-visible:outline-2 focus-visible:outline focus-visible:outline-[var(--color-foreground)] focus-visible:outline-offset-2 cursor-pointer select-none"
        style={{
          background: allowed
            ? "var(--accent-indigo-soft)"
            : "var(--color-card)",
          borderColor: allowed
            ? "var(--accent-indigo)"
            : "var(--color-border)",
        }}
      >
        <svg
          viewBox="0 0 56 56"
          className="absolute inset-0 w-full h-full -rotate-90"
          aria-hidden="true"
        >
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="var(--color-foreground)/10"
            strokeWidth="2"
          />
          <circle
            cx="28"
            cy="28"
            r={radius}
            fill="none"
            stroke="var(--accent-indigo)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: holding
                ? "none"
                : "stroke-dashoffset 200ms var(--ease-out)",
            }}
          />
        </svg>
        <span
          className="font-heading text-[0.625rem] font-medium uppercase tracking-[0.08em]"
          style={{
            color: allowed
              ? "var(--accent-indigo)"
              : "var(--color-muted-foreground)",
          }}
        >
          {allowed ? "✓" : "Hold"}
        </span>
      </button>
      <div className="flex flex-col gap-0.5">
        <span
          className="font-heading font-medium text-[0.875rem]"
          style={{ color: "var(--color-foreground)" }}
        >
          {label}
        </span>
        <span
          className="font-mono text-[0.75rem]"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          {hint}
        </span>
      </div>
    </div>
  );
}