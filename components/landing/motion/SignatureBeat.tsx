// Hero signature beat — clip-path wipe on the cockpit figure plus
// an indigo accent underline drawn beneath the hero word "Recap".
//
// Both elements run on CSS keyframes from globals.css
// (rcp-signature-wipe, rcp-underline-draw). Reduced-motion is
// handled in CSS — the animation collapses to opacity:1 and
// clip-path:none automatically via .rcp-hero-word's !important rule.

export function SignatureBeat() {
  return (
    <svg
      viewBox="0 0 240 12"
      className="block mt-1 w-full max-w-[14rem] h-3"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1="6"
        x2="240"
        y2="6"
        stroke="var(--accent-indigo)"
        strokeWidth="2"
        strokeLinecap="round"
        className="rcp-underline-draw"
      />
    </svg>
  );
}

// Word-by-word fade-up for the hero headline. Each word is a span
// with the .rcp-hero-word class + an inline animation-delay so the
// stagger is data-driven and the reduced-motion override can win
// over inline styles via !important.
export function HeroHeadline({ lead, rest }: { lead: string; rest: string }) {
  const words = rest.split(" ");
  return (
    <h1 className="rcp-display text-[clamp(2.75rem,6.5vw,6rem)] leading-[1.02] tracking-[-0.04em] mt-6 max-w-4xl">
      <span
        className="rcp-accent-text rcp-hero-word"
        style={{
          fontStyle: "italic",
          fontVariationSettings: '"opsz" 144, "SOFT" 50',
        }}
      >
        {lead}
      </span>{" "}
      {words.map((w, i) => (
        <span
          key={i}
          className="rcp-hero-word"
          style={{
            display: "inline-block",
            animation: `rcp-fade-in var(--dur-reveal) var(--ease-out) both`,
            animationDelay: `${300 + i * 60}ms`,
          }}
        >
          {w}
          {i < words.length - 1 ? "\u00a0" : ""}
        </span>
      ))}
    </h1>
  );
}