// FeaturesPanel — left 2/3 column of /auth. The credential surface on
// the right is sticky, so this column carries the scroll. Six sections
// keep it taller than the viewport on a 1440-tall display:
//
//   I    headline + pull-quote
//   II   the Trail pipeline
//   III  Approval gate
//   IV   what you actually see (audit-row mock in SVG)
//   V    receipt stats
//   VI   small FAQ (3 rows)
//
// Server component. Indigo is reserved for: Verify node fill,
// hold-progress bar, input focus ring, and the auth-pane hairline
// pulse on the right. No indigo on body text.

import { SectionRule } from "../landing/SectionRule";
import { Reveal } from "../landing/Reveal";

// ------------------------------------------------------------
// Trail pipeline SVG — 6 numbered stations on one rail. Each
// station carries a plain-language caption so the diagram reads
// on its own, no product jargon required. Verify (5th) is the
// only filled node, shows a pause glyph, and its caption sits in
// a soft indigo chip — the one chromatic moment on the rail.
// Connectors draw over 600ms with a 100ms stagger; stations rise
// in as the pen reaches them.
// ------------------------------------------------------------
function TrailPipelineSvg() {
  const steps = [
    { x: 60,  label: "Source",  caption: "You add the paper" },
    { x: 180, label: "Parse",   caption: "Every page is read" },
    { x: 300, label: "Extract", caption: "Claims pulled out" },
    { x: 420, label: "Score",   caption: "Each claim scored" },
    { x: 540, label: "Verify",  caption: "It waits for you" },
    { x: 660, label: "Done",    caption: "You get the receipt" },
  ];
  const nodeR = 20;
  const y = 76;

  return (
    <svg
      role="img"
      aria-label="The Openwrite Trail pipeline — six steps from link to receipt. Source: you add the paper. Parse: every page is read. Extract: claims pulled out. Score: each claim scored. Verify: it waits for you. Done: you get the receipt. The fifth step, Verify, pauses until you type the repo owner and hold Allow."
      viewBox="0 0 720 178"
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      className="mt-6"
    >
      <g aria-hidden="true">
        <line className="signup-trail-connector c-1" x1={steps[0].x + nodeR} y1={y} x2={steps[1].x - nodeR} y2={y} />
        <line className="signup-trail-connector c-2" x1={steps[1].x + nodeR} y1={y} x2={steps[2].x - nodeR} y2={y} />
        <line className="signup-trail-connector c-3" x1={steps[2].x + nodeR} y1={y} x2={steps[3].x - nodeR} y2={y} />
        <line className="signup-trail-connector c-4" x1={steps[3].x + nodeR} y1={y} x2={steps[4].x - nodeR} y2={y} />
        <line className="signup-trail-connector c-5" x1={steps[4].x + nodeR} y1={y} x2={steps[5].x - nodeR} y2={y} />
      </g>

      <g>
        {steps.map((s, i) => {
          const isVerify = s.label === "Verify";
          const isDone = s.label === "Done";
          return (
            <g key={s.label} className={`signup-trail-node n-${i + 1}`}>
              {/* Step number — the rail is a real sequence, so the
                  order is written on the diagram itself. */}
              <text
                x={s.x}
                y={y - 42}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--font-num)"
                letterSpacing="0.18em"
                fill="var(--color-muted-foreground)"
              >
                {`0${i + 1}`}
              </text>

              <circle
                cx={s.x}
                cy={y}
                r={nodeR}
                fill={isVerify ? "var(--accent-indigo)" : "var(--color-background)"}
                stroke={isVerify ? "var(--accent-indigo)" : "var(--color-foreground)"}
                strokeWidth={1.5}
                aria-hidden={isVerify ? undefined : "true"}
              />
              {!isVerify && !isDone && (
                <circle cx={s.x} cy={y} r={2.5} fill="var(--color-foreground)" aria-hidden="true" />
              )}
              {/* Verify carries a pause glyph — the node IS the pause. */}
              {isVerify && (
                <g aria-hidden="true">
                  <rect x={s.x - 4.5} y={y - 6} width={3} height={12} rx={1} fill="var(--color-background)" />
                  <rect x={s.x + 1.5} y={y - 6} width={3} height={12} rx={1} fill="var(--color-background)" />
                </g>
              )}
              {/* Done closes the rail with a check. */}
              {isDone && (
                <path
                  d={`M ${s.x - 5.5} ${y + 0.5} L ${s.x - 1.5} ${y + 4.5} L ${s.x + 5.5} ${y - 4.5}`}
                  stroke="var(--color-foreground)"
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                />
              )}

              <text
                x={s.x}
                y={y + 44}
                textAnchor="middle"
                fontSize="12.5"
                fontFamily="var(--font-heading)"
                fontWeight={isVerify ? 600 : 500}
                fill="var(--color-foreground)"
                letterSpacing="0.02em"
              >
                {s.label}
              </text>

              {/* Plain-language caption — what this step means for
                  the reader's paper. Verify's caption sits in the
                  soft indigo chip, the section's single accent. */}
              {isVerify && (
                <rect
                  x={s.x - 55}
                  y={y + 54}
                  width={110}
                  height={19}
                  rx={9.5}
                  fill="var(--accent-indigo-soft)"
                  aria-hidden="true"
                />
              )}
              <text
                x={s.x}
                y={y + 67}
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-body)"
                fill={isVerify ? "var(--color-foreground)" : "var(--color-muted-foreground)"}
                fontWeight={isVerify ? 500 : 400}
              >
                {s.caption}
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
// loops 0% to 100% width over 3s.
// ------------------------------------------------------------
function ApprovalGateSvg() {
  const fieldX = 30;
  const fieldW = 440;

  return (
    <svg
      role="img"
      aria-label="Verify gate illustration — the reader types the repo owner, then holds Allow for three seconds. Nothing outside the sandbox is touched."
      viewBox="0 0 500 200"
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      className="mt-6"
    >
      <g aria-hidden="true">
        <rect x={0.75} y={0.75} width={498.5} height={198.5} rx={10} ry={10}
              fill="var(--color-background)" stroke="var(--color-border)" strokeWidth={1.5} />
        <text x={24} y={30} fontFamily="var(--font-heading)" fontSize={11}
              fontWeight={500} letterSpacing="0.14em" fill="var(--color-muted-foreground)">
          VERIFY GATE
        </text>
        <text x={24} y={50} fontFamily="var(--font-body)" fontSize={12} fill="var(--color-muted-foreground)">
          Type the repo owner. Hold Allow.
        </text>
        <rect x={fieldX} y={70} width={fieldW} height={36} rx={6} ry={6}
              fill="var(--color-background)" stroke="var(--color-border)" strokeWidth={1} />
        <text x={fieldX + 14} y={93} fontFamily="var(--font-num)" fontSize={14} fill="var(--color-foreground)">
          acme/papers
        </text>
        {/* Caret sits one mono advance past the text: 11 chars ×
            8.4px at fontSize 14 (JetBrains Mono 0.6em advance). */}
        <line x1={fieldX + 14 + 92} y1={80} x2={fieldX + 14 + 92} y2={96}
              stroke="var(--color-foreground)" strokeWidth={1} />
        <rect x={fieldX} y={122} width={fieldW} height={4} rx={2} ry={2} fill="var(--color-border)" />
        <rect className="signup-hold-progress" x={fieldX} y={122} width={fieldW} height={4} rx={2} ry={2} />
        <rect x={fieldX} y={146} width={fieldW} height={36} rx={6} ry={6} fill="var(--color-foreground)" />
        <text x={250} y={169} textAnchor="middle" fontFamily="var(--font-heading)"
              fontSize={13} fontWeight={500} letterSpacing="0.04em" fill="var(--color-background)">
          Allow
        </text>
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Audit-row mock — a single paper's trail excerpt. Four rows in
// monospaced text, the 4th paused on Verify with a soft indigo
// row tint. Decorative.
// ------------------------------------------------------------
function AuditMockSvg() {
  const rows: { ts: string; role: string; note: string; paused?: boolean }[] = [
    { ts: "10:14:02", role: "source",   note: "arxiv:1706.03762 — pinned to commit 9f3a1c" },
    { ts: "10:14:08", role: "parse",    note: "42 pages · 14 figures · 3 tables" },
    { ts: "10:14:21", role: "extract",  note: "12 claims scored, 3 above the 0.78 floor" },
    { ts: "10:14:31", role: "verify",   note: "awaiting typed owner + 3s hold", paused: true },
  ];

  const rowH = 44;
  const padX = 24;
  // 56px header block (label + rule + gap) above the rows, 12px
  // below the last row — shorting either clips the paused VERIFY
  // row at the bottom edge.
  const totalH = 56 + rows.length * rowH + 12;

  return (
    <svg
      role="img"
      aria-label="Audit row excerpt — four trail rows from a paper run: source, parse, extract, verify. The last row is paused, waiting on the reader."
      viewBox={`0 0 720 ${totalH}`}
      width="100%"
      height="auto"
      preserveAspectRatio="xMidYMid meet"
      className="mt-6"
    >
      <g aria-hidden="true">
        <rect x={0.75} y={0.75} width={718.5} height={totalH - 1.5} rx={10} ry={10}
              fill="var(--color-background)" stroke="var(--color-border)" strokeWidth={1.5} />
        <text x={padX} y={26} fontFamily="var(--font-heading)" fontSize={11}
              fontWeight={500} letterSpacing="0.14em" fill="var(--color-muted-foreground)">
          AUDIT — arxiv 1706.03762
        </text>
        <line x1={padX} y1={40} x2={720 - padX} y2={40}
              stroke="var(--color-border)" strokeWidth={1} />

        {rows.map((r, i) => {
          const yTop = 56 + i * rowH;
          const yMid = yTop + 22;
          return (
            <g key={r.role}>
              {r.paused && (
                <rect x={padX - 8} y={yTop - 4} width={720 - 2 * (padX - 8)} height={rowH - 8}
                      rx={6} ry={6} fill="var(--accent-indigo-soft)" />
              )}
              <text x={padX} y={yMid} fontFamily="var(--font-num)" fontSize={12}
                    fill="var(--color-muted-foreground)">{r.ts}</text>
              <text x={padX + 92} y={yMid} fontFamily="var(--font-heading)" fontSize={11}
                    fontWeight={500} letterSpacing="0.1em" fill="var(--color-foreground)">
                {r.role.toUpperCase()}
              </text>
              <text x={padX + 176} y={yMid} fontFamily="var(--font-body)" fontSize={13}
                    fill="var(--color-foreground)">{r.note}</text>
              {i < rows.length - 1 && (
                <line x1={padX} y1={yTop + rowH - 4} x2={720 - padX} y2={yTop + rowH - 4}
                      stroke="var(--color-border)" strokeWidth={1} />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// ------------------------------------------------------------
// Receipt stat — single number + small caps caption.
// Value in JetBrains Mono so digits align across the three stats.
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
// FAQ row — question in body face, answer in muted body. Static;
// no accordion state. Used three times in the last section.
// ------------------------------------------------------------
function FaqRow({ q, a }: { q: string; a: string }) {
  return (
    <div className="py-5 border-t" style={{ borderColor: "var(--color-border)" }}>
      <p
        className="text-base font-medium"
        style={{ fontFamily: "var(--font-body)", color: "var(--color-foreground)" }}
      >
        {q}
      </p>
      <p
        className="mt-2 text-sm max-w-xl"
        style={{
          fontFamily: "var(--font-body)",
          color: "var(--color-muted-foreground)",
          lineHeight: 1.6,
        }}
      >
        {a}
      </p>
    </div>
  );
}

// ------------------------------------------------------------
// FeaturesPanel — public surface. Renders only the left 2/3
// content; the orchestrator wraps this in a 2:1 grid.
// ------------------------------------------------------------
export function FeaturesPanel() {
  return (
    <Reveal>
      {/* I — Headline + pull-quote */}
      <SectionRule number="I" label="Start with a paper" />
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
        Start with a paper.
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
        Drop a paper, and the agent asks before it does anything
        irreversible. No home directory. No browser profile. No secrets.
      </p>

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

      {/* II — Trail pipeline, in plain words: what happens to a
          paper after you add it, and where the agent stops. */}
      <div className="mt-20">
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
          Six steps from link to verdict. The agent runs the first four on its
          own, the fifth stops and waits for you, and the sixth hands back the
          receipt.
        </p>
        <TrailPipelineSvg />
      </div>

      {/* III — Approval gate */}
      <div className="mt-20">
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

      {/* IV — What you see. Audit-row mock so a reader can
          picture the cockpit before they sign in. */}
      <div className="mt-20">
        <h3
          className="text-xs uppercase tracking-[0.18em] font-medium"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          What you see
        </h3>
        <p
          className="mt-1 text-base max-w-lg"
          style={{ color: "var(--color-foreground)" }}
        >
          Every step lands in the audit trail: timestamp, role, the input that
          produced it. The fourth row is where the agent stops and waits.
        </p>
        <AuditMockSvg />
      </div>

      {/* V — Receipt stats */}
      <div className="mt-20 flex flex-wrap gap-x-10 gap-y-8">
        <Stat value="40" caption="preprints a week" />
        <Stat value="9h → 47m" caption="time on the same papers" />
        <Stat value="0" caption="sends blocked, unverified" />
      </div>

      {/* VI — FAQ. Three short answers to the questions a reader
          is already asking while the auth pane sits sticky on the right. */}
      <div className="mt-20">
        <h3
          className="text-xs uppercase tracking-[0.18em] font-medium"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Common questions
        </h3>
        <div className="mt-4 border-b" style={{ borderColor: "var(--color-border)" }}>
          <FaqRow
            q="Where do my papers live?"
            a="In your account. Each paper is a row in a Postgres table keyed to your user id. Nothing leaves the sandbox the agent runs in."
          />
          <FaqRow
            q="Can the agent write outside the sandbox?"
            a="No. Every tool call has a scope; anything outside it triggers the Verify gate. The agent never sees your filesystem, your browser, or your shell."
          />
          <FaqRow
            q="What does the demo account do?"
            a="It signs you into the seeded cockpit with one paper already on the trail, paused at Verify. You can step the agent through the rest of the run."
          />
        </div>
      </div>
    </Reveal>
  );
}