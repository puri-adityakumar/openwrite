import { Pill } from "../Pill";
import { SectionRule, Reveal } from "./sections";

type GateCardProps = {
  gate: "VERIFY" | "PUBLISH" | "SAVE";
  severity: "IRREVERSIBLE" | "REVERSIBLE";
  title: string;
  body: string;
  quote: string;
  severityColor?: "destructive" | "warn";
  pills: React.ReactNode;
};

function GateChrome({
  gate,
  severity,
  severityColor = "destructive",
}: {
  gate: string;
  severity: string;
  severityColor?: "destructive" | "warn";
}) {
  const severityStyle =
    severityColor === "destructive"
      ? { color: "var(--color-destructive)" }
      : { color: "var(--warn)" };
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-5">
      <span
        className="font-heading font-medium uppercase tracking-[0.08em] text-[0.75rem]"
        style={severityStyle}
      >
        {gate} GATE
      </span>
      <span
        className="font-heading font-medium uppercase tracking-[0.08em] text-[0.75rem]"
        style={severityStyle}
      >
        {severity}
      </span>
    </div>
  );
}

function GateCard({
  gate,
  severity,
  title,
  body,
  quote,
  severityColor,
  pills,
}: GateCardProps) {
  return (
    <Reveal as="article" className="card flex flex-col gap-4">
      <GateChrome gate={gate} severity={severity} severityColor={severityColor} />
      <h3 className="font-heading font-normal text-[1.5rem] leading-[1.2] tracking-[-0.02em] text-[var(--color-foreground)]">
        {title}
      </h3>
      <p className="font-body text-base leading-[1.7] text-[var(--color-foreground)]">
        {body}
      </p>
      <blockquote className="font-body italic border-l-2 border-[var(--color-foreground)]/60 pl-4 text-[var(--color-foreground)]">
        {quote}
      </blockquote>
      <div className="flex items-center justify-end gap-2 mt-1">{pills}</div>
    </Reveal>
  );
}

export function GatesSection() {
  return (
    <section id="gates" className="page-wide py-20 md:py-28 bg-[var(--color-muted)]/30">
      <Reveal>
        <SectionRule number="III" label="Control and safety" />

        <h2 className="font-heading font-light text-[clamp(1.875rem,3vw,2.5rem)] leading-[1.15] tracking-[-0.03em] text-[var(--color-foreground)] max-w-3xl">
          Three approval gates. Nothing irreversible slips through.
        </h2>

        <p className="mt-5 font-heading font-normal text-base md:text-lg leading-[1.6] text-[var(--color-muted-foreground)] max-w-2xl">
          Verify. Publish. Save. Each one asks before the agent does anything you cannot take back. The agent has no access to your home directory, browser profile, or any secrets. You may deny at any time. Affected claims will be marked unverified.
        </p>

        <div className="mt-12 space-y-6 md:space-y-8">
          <GateCard
            gate="VERIFY"
            severity="IRREVERSIBLE"
            title="Verify"
            body="Provenance, declared intent, resource budget, sandbox envelope, risk flags, kill switch. Type the repo owner and hold Allow for three seconds before any code runs."
            quote="Type the repo owner. Hold for three seconds."
            severityColor="destructive"
            pills={
              <>
                <Pill tone="warn">Expires 5m</Pill>
                <Pill tone="idle">Sandbox</Pill>
              </>
            }
          />

          <GateCard
            gate="PUBLISH"
            severity="IRREVERSIBLE"
            title="Publish"
            body="A diff between the claimed numbers and what Recap actually reproduced. Allow to unlock the markdown export."
            quote="Reproduced 91.7% · claimed 92.4% · Δ −0.7"
            severityColor="destructive"
            pills={
              <>
                <Pill tone="good">Reproduced</Pill>
                <Pill tone="warn">Δ −0.7</Pill>
              </>
            }
          />

          <GateCard
            gate="SAVE"
            severity="REVERSIBLE"
            title="Save"
            body="Annotations you made while reading. Merge them into the audit, or keep them local."
            quote="Merge. Keep local."
            severityColor="warn"
            pills={<Pill tone="good">Reversible</Pill>}
          />
        </div>

        </Reveal>
    </section>
  );
}