import { SectionRule, Reveal } from "./sections";

type Stat = {
  value: string;
  caption: string;
};

const STATS: Stat[] = [
  { value: "40", caption: "preprints a week" },
  { value: "9h → 47m", caption: "time on the same papers" },
  { value: "0", caption: "sends blocked, unverified" },
];

export function ReceiptSection() {
  return (
    <section id="receipt" className="page-wide py-20 md:py-28">
      <Reveal>
        <SectionRule number="IV" label="The receipt" />

        <h2 className="font-heading font-light text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.15] tracking-[-0.03em] text-[var(--color-foreground)] max-w-3xl">
          Forty pages. Two hours. The week does not have it.
        </h2>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
          <Reveal className="md:col-span-7" as="div">
            <blockquote className="font-body italic text-[clamp(1.25rem,1.6vw,1.625rem)] leading-[1.55] text-[var(--color-foreground)] border-l-2 border-[var(--color-foreground)]/60 pl-6">
              Forty pages. Two hours. The week does not have it. Recap is the receipt for a paper you have to read.
              <footer className="mt-6 not-italic text-sm text-[var(--color-muted-foreground)] font-heading tracking-[0.04em] uppercase">
                Dr. K. Week one.
              </footer>
            </blockquote>
          </Reveal>

          <Reveal className="md:col-span-5" as="div" delay={120}>
            <dl className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-6 items-baseline">
              {STATS.map((s) => (
                <div key={s.caption} className="contents">
                  <dt className="font-heading font-light text-[clamp(3rem,4vw,4rem)] leading-none tracking-[-0.03em] text-[var(--color-foreground)]">
                    {s.value}
                  </dt>
                  <dd className="font-heading font-medium text-[0.75rem] uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] self-center">
                    {s.caption}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        </Reveal>
    </section>
  );
}