// Editorial section rule — the page's structural repeat.
// Thin ink rule on the left, label centered in the rule,
// Roman numeral on the right. Evolves the rcp-eyebrow kicker
// pattern from globals.css into a horizontal signature line.
//
// Server component. No state, no effects.

type SectionRuleProps = {
  number: "I" | "II" | "III" | "IV" | "V";
  label: string;
};

export function SectionRule({ number, label }: SectionRuleProps) {
  return (
    <header className="flex items-end justify-between gap-6 mb-10 md:mb-14">
      <div className="flex-1 flex items-center gap-4">
        <span
          aria-hidden
          className="h-px flex-1 bg-[var(--color-foreground)]/15"
        />
        <span className="font-heading text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-[var(--color-muted-foreground)] whitespace-nowrap">
          {label}
        </span>
        <span aria-hidden className="h-px w-12 bg-[var(--color-foreground)]/40" />
      </div>
      <span
        aria-hidden
        className="font-heading font-light text-[0.6875rem] tracking-[0.18em] uppercase text-[var(--color-muted-foreground)]"
      >
        {number}
      </span>
    </header>
  );
}