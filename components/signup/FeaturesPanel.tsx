// FeaturesPanel — left 2/3 column of the redesigned /signup.
// Server component (no "use client"). Renders the editorial
// headline, a Fraunces italic pull-quote, the Trail pipeline
// illustration (6 nodes, indigo Verify fill), the Approval
// gate illustration (typed owner field + looping indigo
// hold-progress bar), and a three-up receipt-stats trio.
//
// The orchestrator's app/signup/page.tsx wraps this in a 12-col
// grid container; this component renders only the left content.
// SVG animations are defined in ./signup.css. Token references
// are inline style={{}} so this file compiles without touching
// app/globals.css.
//
// Indigo is reserved for: Verify node fill, hold-progress bar,
// input focus ring, card hover shadow. No indigo on body text.

import { SectionRule } from "../landing/SectionRule";
import { Reveal } from "../landing/Reveal";

// ------------------------------------------------------------
// Trail pipeline SVG — 6 horizontal nodes. Verify (5th) is the
// only filled node and the only chromatic mark on the diagram
// (signup-specific use of var(--accent-indigo)). Connectors
// between nodes draw over 600ms with a 100ms stagger via the
// rcp-trail-stroke-draw keyframe in signup.css.
// ------------------------------------------------------------
function TrailPipelineSvg() {
  const nodes = [
    { x: 60,  label: "Source"  },
    { x: 165, label: "Parse"   },
    { x: 270, label: "Extract" },
    { x: 375, label: "Score"   },
    { x: 480, label: "Verify"  },
    { x: 585, label: "Done"    },
  ];
  const nodeR = 22;
  const y = 70;

  return (
    <svg
      role="img"
      aria-labelledby="signup-trail-title signup-trail-desc"
      viewBox="0 0 645 160"
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      className="mt-6"
    >
      <title id="signup-trail-title">The Openwrite Trail pipeline</title>
      <desc id="signup-trail-desc">
        Six steps from URL to verdict. Source, Parse, Extract, Score, Verify, Done.
        The Verify step pauses for the reader to type the repo owner and hold Allow
        before the agent proceeds.
      </desc>

      {/* Connectors — drawn first so the nodes overlay the joints. */}
      <g aria-hidden="true">
        <line
          className="signup-trail-connector c-1"
          x1={nodes[0].x + nodeR}
          y1={y}
          x2={nodes[1].x - nodeR}
          y2={y}
        />
        <line
          className="signup-trail-connector c-2"
          x1={nodes[1].x + nodeR}
          y1={y}
          x2={nodes[2].x - nodeR}
          y2={y}
        />
        <line
          className="signup-trail-connector c-3"
          x1={nodes[2].x + nodeR}
          y1={y}
          x2={nodes[3].x - nodeR}
          y2={y}
        />
        <line
          className="signup-trail-connector c-4"
          x1={nodes[3].x + nodeR}
          y1={y}
          x2={nodes[4].x - nodeR}
          y2={y}
        />
        <line
          className="signup-trail-connector c-5"
          x1={nodes[4].x + nodeR}
          y1={y}
          x2={nodes[5].x - nodeR}
          y2={y}
        />
      </g>

      {/* Nodes — all stroke-only line art except Verify (5th),
          which is filled with var(--accent-indigo). Decorative
          center dots are marked aria-hidden on their own line
          so the screen reader gets only the meaningful text. */}
      <g>
        {nodes.map((n) => {
          const isVerify = n.label === "Verify";
          return (
            <g key={n.label}>
              <circle
                cx={n.x}
                cy={y}
                r={nodeR}
                fill={isVerify ? "var(--accent-indigo)" : "var(--color-background)"}
                stroke={isVerify ? "var(--accent-indigo)" : "var(--color-foreground)"}
                strokeWidth={1.5}
                aria-hidden={isVerify ? undefined : "true"}
              />
              {!isVerify && (
                <circle
                  cx={n.x}
                  cy={y}
                  r={2.5}
                  fill="var(--color-foreground)"
                  aria-hidden="true"
                />
              )}
              <text
                x={n.x}
                y={y + 44}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-body)"
                fontWeight={isVerify ? 500 : 400}
                fill="var(--color-foreground)"
                letterSpacing="0.01em"
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Approval gate SVG — small card showing the identity-confirm
// gesture. A typed "owner" field with a thin progress bar that
// loops 0% to 100% width over 3s via the rcp-hold-fill keyframe.
// Bar color is var(--accent-indigo). Decorative geometry is
// marked aria-hidden on a wrapping group so the screen reader
// hears only the title + desc.
// ------------------------------------------------------------
function ApprovalGateSvg() {
  const fieldX = 30;
  const fieldW = 440;

  return (
    <svg
      role="img"
      aria-labelledby="signup-gate-title signup-gate-desc"
      viewBox="0 0 500 200"
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      className="mt-6"
    >
      <title id="signup-gate-title">Verify gate illustration</title>
      <desc id="signup-gate-desc">
        The reader types the repo owner into the field, then holds Allow for three
        seconds. The progress bar fills left to right in indigo. Nothing outside the
        sandbox is touched.
      </desc>

      <g aria-hidden="true">
        {/* Card outline */}
        <rect
          x={0.75}
          y={0.75}
          width={498.5}
          height={198.5}
          rx={10}
          ry={10}
          fill="var(--color-background)"
          stroke="var(--color-border)"
          strokeWidth={1.5}
        />

        {/* Card label — Raleway 500 caps */}
        <text
          x={24}
          y={30}
          fontFamily="var(--font-heading)"
          fontSize={11}
          fontWeight={500}
          letterSpacing="0.14em"
          fill="var(--color-muted-foreground)"
        >
          VERIFY GATE
        </text>

        {/* Subtitle */}
        <text
          x={24}
          y={50}
          fontFamily="var(--font-body)"
          fontSize={12}
          fill="var(--color-muted-foreground)"
        >
          Type the repo owner. Hold Allow.
        </text>

        {/* Text field */}
        <rect
          x={fieldX}
          y={70}
          width={fieldW}
          height={36}
          rx={6}
          ry={6}
          fill="var(--color-background)"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
        <text
          x={fieldX + 14}
          y={93}
          fontFamily="var(--font-num)"
          fontSize={14}
          fill="var(--color-foreground)"
        >
          acme/papers
        </text>
        {/* Caret — single thin bar at the end of the typed text */}
        <line
          x1={fieldX + 14 + 78}
          y1={80}
          x2={fieldX + 14 + 78}
          y2={96}
          stroke="var(--color-foreground)"
          strokeWidth={1}
        />

        {/* Progress bar track + indigo fill */}
        <rect
          x={fieldX}
          y={122}
          width={fieldW}
          height={4}
          rx={2}
          ry={2}
          fill="var(--color-border)"
        />
        <rect
          className="signup-hold-progress"
          x={fieldX}
          y={122}
          width={fieldW}
          height={4}
          rx={2}
          ry={2}
        />

        {/* Allow button */}
        <rect
          x={fieldX}
          y={146}
          width={fieldW}
          height={36}
          rx={6}
          ry={6}
          fill="var(--color-foreground)"
        />
        <text
          x={250}
          y={169}
          textAnchor="middle"
          fontFamily="var(--font-heading)"
          fontSize={13}
          fontWeight={500}
          letterSpacing="0.04em"
          fill="var(--color-background)"
        >
          Allow
        </text>
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Receipt stat — single number + small caps caption.
// Value is set in JetBrains Mono so the digits have consistent
// advance widths across the three stats (40, 9h → 47m, 0).
// ------------------------------------------------------------
function Stat({ value, caption }: { value: string; caption: string }) {
  return (
    <div>
      <div
        className="font-light leading-none tracking-[-0.025em] whitespace-nowrap"
        style={{
          fontFamily: "var(--font-num)",
          fontSize: "clamp(2.5rem, 4vw, 3.75rem)",
        }}
      >
        {value}
      </div>
      <div
        className="mt-2 text-[0.75rem] uppercase tracking-[0.06em] font-medium"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--color-muted-foreground)",
        }}
      >
        {caption}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// FeaturesPanel — public surface. Renders only the left 2/3
// content; the orchestrator wraps this in a 12-col grid.
// ------------------------------------------------------------
export function FeaturesPanel() {
  return (
    <Reveal>
      <SectionRule number="II" label="Step 1 of 1" />

      <h1
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          fontSize: "clamp(2.75rem, 5vw, 4rem)",
          lineHeight: 1.05,
          color: "var(--color-foreground)",
        }}
      >
        Create an account.
        <br />
        You decide what the agent runs.
      </h1>

      <p
        className="mt-6 max-w-xl text-base"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--color-muted-foreground)",
          lineHeight: 1.65,
        }}
      >
        Sign up, drop a paper, and the agent asks before it does anything
        irreversible. No home directory. No browser profile. No secrets.
      </p>

      {/* Pull-quote — Fraunces italic blockquote with a thin
          indigo left border. Caption sits below in Raleway
          500 caps. Indigo use here is the receipt color, not
          body text, so it stays under the 18px body-text rule. */}
      <figure className="mt-10">
        <blockquote
          className="pl-4 border-l-2 italic"
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: "clamp(1.25rem, 1.8vw, 1.5rem)",
            lineHeight: 1.45,
            borderColor: "var(--accent-indigo)",
            color: "var(--color-foreground)",
          }}
        >
          Forty pages. Two hours. The week does not have it.
        </blockquote>
        <figcaption
          className="mt-2 pl-4 text-[0.75rem] uppercase tracking-[0.14em] font-medium"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-muted-foreground)",
          }}
        >
          Dr. K.
        </figcaption>
      </figure>

      {/* Block 1 — Trail pipeline */}
      <div className="mt-14">
        <h3
          className="text-xs uppercase tracking-[0.18em] font-medium"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          The Trail
        </h3>
        <p
          className="mt-1 text-base max-w-lg"
          style={{ color: "var(--color-foreground)" }}
        >
          Six steps from URL to verdict. The agent runs each in a Daytona sandbox,
          pausing on the fifth for your explicit approval.
        </p>
        <TrailPipelineSvg />
      </div>

      {/* Block 2 — Approval gate */}
      <div className="mt-16">
        <h3
          className="text-xs uppercase tracking-[0.18em] font-medium"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Approval
        </h3>
        <p
          className="mt-1 text-base max-w-lg"
          style={{ color: "var(--color-foreground)" }}
        >
          Type the repo owner. Hold Allow for three seconds. The agent has no
          access to anything outside the sandbox.
        </p>
        <ApprovalGateSvg />
      </div>

      {/* Block 3 — Receipt stats. Flex with min-width per item so
          the longer "9h -> 47m" value does not overlap its
          neighbours (which a strict 3-col grid would have). */}
      <div className="mt-16 flex flex-wrap gap-x-10 gap-y-8">
        <Stat value="40" caption="preprints a week" />
        <Stat value="9h → 47m" caption="time on the same papers" />
        <Stat value="0" caption="sends blocked, unverified" />
      </div>
    </Reveal>
  );
}