// Brand mark + wordmark for Openwrite.
// Two thin strokes suggest an open book's spine; a small filled
// square to the right reads as a page corner or punctuation dot.
// See design-audit/01-design-system.md for the monochrome-only
// direction: no brand color, currentColor inherits theme.

import type { SVGProps } from "react";

type LogoProps = {
  size?: number;
  showWordmark?: boolean;
  mark?: boolean;
  className?: string;
};

export function Logo({ size = 28, showWordmark = true, mark = true, className = "" }: LogoProps) {
  return (
    <a
      href="/auth"
      aria-label="Openwrite"
      className={`inline-flex items-center gap-2 no-underline ${className}`}
      style={{ color: "var(--color-foreground)" }}
    >
      {mark && <LogoMark size={size} />}
      {showWordmark && (
        <span
          className="font-heading"
          style={{
            fontFamily: "var(--font-heading)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            fontSize: `${Math.round(size * 0.72)}px`,
            lineHeight: 1,
            color: "inherit",
          }}
        >
          Openwrite
        </span>
      )}
    </a>
  );
}

export function LogoMark({
  size = 28,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  // 28x28 viewBox: two angled strokes form an open-book spine,
  // a filled square sits to the right as the punctuation dot.
  const props: SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 28 28",
    fill: "none",
    role: "img",
    "aria-label": "Openwrite",
    className,
    xmlns: "http://www.w3.org/2000/svg",
  };
  return (
    <svg {...props}>
      <title>Openwrite</title>
      <path
        d="M 5 12 L 14 10 L 14 19 L 5 17"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 19 13 h 6 v 6 h -6 z"
        fill="currentColor"
      />
    </svg>
  );
}