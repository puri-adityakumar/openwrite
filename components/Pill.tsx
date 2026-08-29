import type { ReactNode } from "react";

export type PillTone = "good" | "warn" | "bad" | "idle" | "accent";

/**
 * Status pill — the canonical surface for trail progress, gate
 * results, cap state, env banner, and the "What the agent does"
 * pipeline summary. The dot carries the meaning; the label carries
 * the words; together they form one state.
 *
 * Tone defaults to "idle" if not provided, which gives a muted
 * gray dot suitable for "no result yet" or "unknown" states.
 */
export function Pill({
  tone = "idle",
  children,
  className,
  ...rest
}: {
  tone?: PillTone;
  children: ReactNode;
  className?: string;
  "data-testid"?: string;
  "data-state"?: string;
  "data-annotation-id"?: string;
  title?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`pill ${className ?? ""}`} {...rest}>
      <span className={`pill-dot ${tone}`} />
      {children}
    </span>
  );
}
