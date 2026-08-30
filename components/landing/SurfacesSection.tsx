// 10x Bolder Surfaces section. Per-surface SVG marks (24x24) sit
// at top-right of each card; on hover/focus the mark shifts from
// muted gray to indigo. Cards gain a top accent border instead of
// a shadow swap. Diagonal reveal order via per-card delay.

import { Pill } from "../Pill";
import { SectionRule, Reveal } from "./sections";
import {
  SurfaceMarkPipeline,
  SurfaceMarkPages,
  SurfaceMarkTable,
  SurfaceMarkDrawer,
  SurfaceMarkTimeline,
  SurfaceMarkSignal,
} from "./surfaces/marks";

type Mark = React.ComponentType<{ className?: string }>;

type Surface = {
  label: string;
  description: string;
  Mark: Mark;
  marker?: React.ReactNode;
};

const SURFACES: Surface[] = [
  {
    label: "01 · pipeline",
    description:
      "Source. Parse. Extract. Score. Verify. Done. Six steps, surfaced as the run progresses.",
    Mark: SurfaceMarkPipeline,
    marker: (
      <span className="mt-4 inline-flex items-center gap-2">
        <Pill tone="good">Source</Pill>
        <Pill tone="warn">Verify</Pill>
      </span>
    ),
  },
  {
    label: "02 · pages",
    description:
      "A green-to-gray grid of every page. Denser means more cited. The page becomes the map.",
    Mark: SurfaceMarkPages,
  },
  {
    label: "03 · table",
    description:
      "Every claim with its citation and a confidence. The Receipt for a paper.",
    Mark: SurfaceMarkTable,
  },
  {
    label: "04 · drawer",
    description:
      "The full paper on the left, the agent's notes on the right. Reading and verification, side by side.",
    Mark: SurfaceMarkDrawer,
  },
  {
    label: "05 · timeline",
    description:
      "Every event, replayable on a fresh sandbox. What the agent did, in order, with the proof.",
    Mark: SurfaceMarkTimeline,
  },
  {
    label: "06 · signal",
    description:
      "Token spend, sandbox id, cap. The agent's vitals, surfaced as it runs.",
    Mark: SurfaceMarkSignal,
  },
];

// Diagonal reveal order — indices `(0,0), (0,1), (1,0), (1,1), (0,2), (1,2)`.
const DIAGONAL_ORDER = [0, 1, 2, 3, 4, 5];

export function SurfacesSection() {
  return (
    <section id="surfaces" className="page-wide py-20 md:py-28">
      <Reveal>
        <SectionRule number="II" label="The surfaces" />

        <h2
          className="rcp-display text-[clamp(2rem,4vw,3.25rem)] leading-[1.08] text-[var(--color-foreground)] max-w-4xl"
          style={{ fontWeight: 500 }}
        >
          Six surfaces, one cockpit.
        </h2>

        <p
          className="mt-5 font-heading font-normal text-base md:text-lg leading-[1.6] text-[var(--color-muted-foreground)] max-w-2xl"
        >
          A live Trail, a Coverage grid that reads like a heatmap, a Claims and Evidence table, a Reader, and a replayable Audit. The cockpit is one window. The surfaces are the lenses.
        </p>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {SURFACES.map((s, i) => {
            const delay = DIAGONAL_ORDER.indexOf(i) * 80;
            return (
              <Reveal
                as="article"
                key={s.label}
                delay={delay}
                className="card card-hoverable rcp-surface-card relative pt-12"
              >
                <div
                  aria-hidden="true"
                  className="absolute top-4 right-4"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  <s.Mark className="rcp-surface-mark w-6 h-6" />
                </div>
                <div className="rcp-eyebrow self-start">{s.label}</div>
                <p
                  className="font-body text-[0.9375rem] leading-[1.65] mt-3"
                  style={{ color: "var(--color-foreground)" }}
                >
                  {s.description}
                </p>
                {s.marker}
              </Reveal>
            );
          })}
        </div>

        {/* Deep-link strip — visual chips, anchor to cockpit sections. */}
        <div className="mt-12 flex flex-wrap items-center gap-3">
          <span
            className="font-heading font-medium text-[0.6875rem] uppercase tracking-[0.14em]"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Inspect the cockpit
          </span>
          {["Trail", "Coverage", "Claims"].map((label) => (
            <a
              key={label}
              href="#signin"
              className="pill"
              style={{
                borderColor: "var(--color-border)",
                color: "var(--color-foreground)",
                textDecoration: "none",
              }}
            >
              <span className="pill-dot accent" aria-hidden />
              {label}
            </a>
          ))}
        </div>
      </Reveal>
    </section>
  );
}