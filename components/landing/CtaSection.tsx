// 10x Bolder CTA. Inverted full-bleed panel — leaves the muted
// zebra band behind. Fraunces display title, indigo button with a
// 4px indigo glow on hover, terminal-style command snippet with a
// blinking caret. The "Powered by" line moves to the panel footer
// in muted white.

import { SectionRule, Reveal } from "./sections";

function TerminalSnippet() {
  return (
    <div
      role="region"
      aria-label="Boot command"
      className="font-mono text-[0.875rem] inline-flex items-center gap-2 px-4 py-2.5 rounded-md border"
      style={{
        borderColor: "hsl(0 0% 100% / 0.15)",
        background: "hsl(220 9% 6% / 0.4)",
        color: "hsl(0 0% 100% / 0.85)",
      }}
    >
      <span aria-hidden="true" style={{ color: "var(--accent-indigo)" }}>$</span>
      <span>docker compose up &amp;&amp; open http://localhost:3000</span>
      <span
        aria-hidden="true"
        className="rcp-caret-blink inline-block w-2 h-4 -mb-0.5"
        style={{ background: "var(--accent-indigo)" }}
      />
    </div>
  );
}

export function CtaSection() {
  return (
    <section id="open-cockpit" className="rcp-cta-panel py-24 md:py-40 px-6">
      <Reveal>
        <div className="page-wide">
          <header className="flex items-end justify-between gap-6 mb-10 md:mb-14">
            <div className="flex-1 flex items-center gap-4">
              <span
                aria-hidden
                className="h-px flex-1"
                style={{ background: "hsl(0 0% 100% / 0.2)" }}
              />
              <span
                className="font-heading text-[0.6875rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap"
                style={{ color: "hsl(0 0% 100% / 0.7)" }}
              >
                Open the cockpit
              </span>
              <span
                aria-hidden
                className="h-px w-12"
                style={{ background: "hsl(0 0% 100% / 0.5)" }}
              />
            </div>
            <span
              aria-hidden
              className="font-heading font-light text-[0.6875rem] tracking-[0.18em] uppercase"
              style={{ color: "hsl(0 0% 100% / 0.6)" }}
            >
              V
            </span>
          </header>

          <h2
            className="rcp-display text-[clamp(2.25rem,5vw,4.25rem)] leading-[1.04] tracking-[-0.04em] max-w-4xl"
          >
            One command. Three verbs. Six surfaces. Zero surprises.
          </h2>

          <p className="mt-5 font-heading font-normal text-base md:text-lg leading-[1.6] max-w-2xl">
            After npm install, the only setup command is docker compose up. The cockpit first paint is a populated demo run, not an empty state.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="/#signin"
              className="btn btn-indigo"
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 600,
                letterSpacing: "0.01em",
                padding: "0.875rem 1.5rem",
              }}
            >
              Sign in to the cockpit
            </a>
            <a
              href="/signup"
              className="btn"
              style={{
                background: "transparent",
                borderColor: "hsl(0 0% 100% / 0.3)",
                color: "hsl(0 0% 100%)",
              }}
            >
              Create an account
            </a>
          </div>

          <div className="mt-10">
            <TerminalSnippet />
          </div>

          <p
            className="mt-12 font-heading font-medium text-[0.6875rem] uppercase tracking-[0.14em]"
            style={{ color: "hsl(0 0% 100% / 0.5)" }}
          >
            Powered by TrueForge · Daytona · GMI · Qodo
          </p>
        </div>
      </Reveal>
    </section>
  );
}