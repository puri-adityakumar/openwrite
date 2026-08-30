import { Pill } from "../Pill";
import { SectionRule, Reveal } from "./sections";

type Surface = {
  label: string;
  description: string;
  marker?: React.ReactNode;
};

const SURFACES: Surface[] = [
  {
    label: "01 · pipeline",
    description:
      "Source. Parse. Extract. Score. Verify. Done. Six steps, surfaced as the run progresses.",
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
  },
  {
    label: "03 · table",
    description:
      "Every claim with its citation and a confidence. The Receipt for a paper.",
  },
  {
    label: "04 · drawer",
    description:
      "The full paper on the left, the agent's notes on the right. Reading and verification, side by side.",
  },
  {
    label: "05 · timeline",
    description:
      "Every event, replayable on a fresh sandbox. What the agent did, in order, with the proof.",
  },
  {
    label: "06 · signal",
    description:
      "Token spend, sandbox id, cap. The agent's vitals, surfaced as it runs.",
  },
];

export function SurfacesSection() {
  return (
    <section id="surfaces" className="page-wide py-20 md:py-28">
      <Reveal>
        <SectionRule number="II" label="The surfaces" />

        <h2 className="font-heading font-light text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.15] tracking-[-0.03em] text-[var(--color-foreground)] max-w-3xl">
          Six surfaces, one cockpit.
        </h2>

        <p className="mt-5 font-heading font-normal text-base md:text-lg leading-[1.6] text-[var(--color-muted-foreground)] max-w-2xl">
          A live Trail, a Coverage grid that reads like a heatmap, a Claims and Evidence table, a Reader, and a replayable Audit. The cockpit is one window. The surfaces are the lenses.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {SURFACES.map((s) => (
            <Reveal as="article" key={s.label} className="card flex flex-col gap-3 hover:shadow-md transition-shadow duration-200">
              <div className="rcp-eyebrow self-start">{s.label}</div>
              <p className="font-body text-[0.9375rem] leading-[1.65] text-[var(--color-foreground)]">
                {s.description}
              </p>
              {s.marker}
            </Reveal>
          ))}
        </div>

        </Reveal>
    </section>
  );
}