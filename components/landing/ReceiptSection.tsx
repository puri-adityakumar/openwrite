// 10x Bolder Receipt. Display pull-quote in Fraunces italic with a
// left accent rule that animates from 0 to full height. Stats
// count up from 0 to their target on viewport entry. The arrow
// between 9h and 47m draws on a small delay after the count lands.

import { SectionRule, Reveal } from "./sections";
import { CounterStat } from "./motion/CounterStat";

function ArrowDraw() {
  return (
    <svg
      viewBox="0 0 60 24"
      className="block mx-2 w-12 h-6 align-middle"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <line
        x1="0"
        y1="12"
        x2="56"
        y2="12"
        stroke="var(--accent-indigo)"
        strokeWidth="2"
        strokeLinecap="round"
        style={{
          strokeDasharray: 56,
          strokeDashoffset: 56,
          animation: "rcp-underline-draw 600ms var(--ease-out) 1300ms forwards",
        }}
      />
      <polyline
        points="48,4 60,12 48,20"
        fill="none"
        stroke="var(--accent-indigo)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          strokeDasharray: 30,
          strokeDashoffset: 30,
          animation: "rcp-underline-draw 400ms var(--ease-out) 1700ms forwards",
        }}
      />
    </svg>
  );
}

export function ReceiptSection() {
  return (
    <section id="receipt" className="page-wide py-20 md:py-28">
      <Reveal>
        <SectionRule number="IV" label="The receipt" />

        <h2
          className="rcp-display text-[clamp(2rem,4vw,3.25rem)] leading-[1.08] text-[var(--color-foreground)] max-w-4xl"
          style={{ fontWeight: 500 }}
        >
          Forty pages. Two hours. The week does not have it.
        </h2>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
          <Reveal className="md:col-span-7" as="div">
            <div className="relative pl-6">
              <span
                aria-hidden="true"
                className="rcp-rule-rise absolute left-0 top-0 bottom-0 w-[3px]"
                style={{
                  background: "var(--accent-indigo)",
                  transformOrigin: "top center",
                }}
              />
              <blockquote className="rcp-display-body text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.25] text-[var(--color-foreground)]">
                Forty pages. Two hours. The week does not have it. Recap is the
                receipt for a paper you have to read.
                <footer
                  className="mt-8 not-italic font-heading text-[0.75rem] tracking-[0.06em] uppercase"
                  style={{ color: "var(--color-muted-foreground)" }}
                >
                  Dr. K. Week one.
                </footer>
              </blockquote>
            </div>
          </Reveal>

          <Reveal className="md:col-span-5" as="div" delay={120}>
            <dl
              aria-live="polite"
              className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-8 items-baseline"
            >
              <CounterStat to={40} caption="preprints a week" />
              <CounterStat to={9} caption="hours, before" suffix="h" />
              <div className="contents">
                <dt aria-hidden="true">
                  <ArrowDraw />
                </dt>
                <dd aria-hidden="true" />
              </div>
              <CounterStat to={47} caption="minutes, after" suffix="m" />
              <CounterStat to={0} caption="sends blocked, unverified" />
            </dl>
          </Reveal>
        </div>
      </Reveal>
    </section>
  );
}