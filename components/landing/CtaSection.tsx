import { SectionRule, Reveal } from "./sections";

export function CtaSection() {
  return (
    <section id="open-cockpit" className="page-wide py-20 md:py-28 bg-[var(--color-muted)]/30">
      <Reveal>
        <SectionRule number="V" label="Open the cockpit" />

        <h2 className="font-heading font-light text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.15] tracking-[-0.03em] text-[var(--color-foreground)] max-w-3xl">
          One command. Three verbs. Six surfaces. Zero surprises.
        </h2>

        <p className="mt-5 font-heading font-normal text-base md:text-lg leading-[1.6] text-[var(--color-muted-foreground)] max-w-2xl">
          After npm install, the only setup command is docker compose up. The cockpit first paint is a populated demo run, not an empty state.
        </p>

        <div className="mt-10">
          <a
            href="/#signin"
            className="inline-flex items-center justify-center bg-[var(--color-foreground)] text-[var(--color-background)] hover:opacity-90 transition-opacity duration-200 px-6 py-3 rounded-md font-heading tracking-[0.02em]"
          >
            Sign in to the cockpit
          </a>
        </div>

        <p className="mt-6 font-heading font-medium text-[0.75rem] uppercase tracking-[0.04em] text-[var(--color-muted-foreground)]">
          Powered by TrueForge · Daytona · GMI · Qodo
        </p>

        </Reveal>
    </section>
  );
}