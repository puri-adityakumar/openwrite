// 10x Bolder Gates section. Each gate gets a stateful interactive
// mock instead of static pills:
//   - Verify: "Hold to Allow" radial progress (3s)
//   - Publish: live diff bar with Δ indicator that animates into place
//   - Save: inline toggle (aria-checked, off-screen label)
// Severity color appears as a 3px solid left border per card.

import { SectionRule, Reveal } from "./sections";
import { Pill } from "../Pill";
import { HoldToAllow } from "./motion/HoldToAllow";

function GateChrome({
  gate,
  severity,
  severityColor,
}: {
  gate: string;
  severity: string;
  severityColor: "destructive" | "accent";
}) {
  const colorVar =
    severityColor === "destructive" ? "var(--color-destructive)" : "var(--accent-indigo)";
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-5">
      <span
        className="font-heading font-medium uppercase tracking-[0.08em] text-[0.75rem]"
        style={{ color: colorVar }}
      >
        {gate} GATE
      </span>
      <span
        className="font-heading font-medium uppercase tracking-[0.08em] text-[0.75rem]"
        style={{
          color: colorVar,
          border: `1px solid ${colorVar}`,
          padding: "0.125rem 0.5rem",
          borderRadius: "var(--radius-full)",
        }}
      >
        {severity}
      </span>
    </div>
  );
}

// Publish — live diff bar.
function DiffBar({
  reproduced,
  claimed,
  delta,
}: {
  reproduced: number;
  claimed: number;
  delta: number;
}) {
  const reproPct = Math.min(reproduced, 100);
  const claimPct = Math.min(claimed, 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-heading">
        <span style={{ color: "var(--color-muted-foreground)" }}>
          reproduced {reproduced}%
        </span>
        <span style={{ color: "var(--color-muted-foreground)" }}>
          claimed {claimed}%
        </span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "var(--color-secondary)" }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${reproPct}%`,
            background: "var(--good)",
            animation: "rcp-rule-fill 1.4s var(--ease-out) both",
            transformOrigin: "left center",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 border-r-2"
          style={{
            width: `${claimPct}%`,
            borderColor: "var(--warn)",
            animation: "rcp-rule-fill 1.4s var(--ease-out) 200ms both",
            transformOrigin: "left center",
          }}
        />
      </div>
      <p
        className="font-mono text-[0.75rem] flex items-center gap-2"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Δ
        <span style={{ color: "var(--color-destructive)" }}>
          {delta.toFixed(1)}
        </span>
        <span aria-hidden="true">→</span>
        Allow to unlock export
      </p>
    </div>
  );
}

// Save — inline toggle with aria-checked.
function SaveToggle() {
  // Default to "Merge into audit" per the spec.
  return (
    <div
      role="group"
      aria-label="Save behavior"
      className="inline-flex p-1 rounded-full border"
      style={{ borderColor: "var(--color-border)", background: "var(--color-secondary)" }}
    >
      <button
        type="button"
        aria-pressed="true"
        className="font-heading text-[0.75rem] uppercase tracking-[0.08em] px-3 py-1.5 rounded-full"
        style={{
          background: "var(--color-card)",
          color: "var(--color-foreground)",
          boxShadow: "inset 0 0 0 1px var(--color-border)",
        }}
      >
        Merge into audit
      </button>
      <button
        type="button"
        aria-pressed="false"
        className="font-heading text-[0.75rem] uppercase tracking-[0.08em] px-3 py-1.5 rounded-full"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Keep local
      </button>
    </div>
  );
}

type GateCardProps = {
  gate: "VERIFY" | "PUBLISH" | "SAVE";
  severity: "IRREVERSIBLE" | "REVERSIBLE";
  severityColor: "destructive" | "accent";
  title: string;
  body: string;
  quote: string;
  mock: React.ReactNode;
  delay?: number;
};

function GateCard({
  gate,
  severity,
  severityColor,
  title,
  body,
  quote,
  mock,
  delay,
}: GateCardProps) {
  return (
    <Reveal
      as="article"
      delay={delay}
      className="card rcp-gate-card pl-6 pr-6 py-6 flex flex-col gap-4"
      data-severity={severity === "IRREVERSIBLE" ? "irreversible" : "reversible"}
    >
      <GateChrome gate={gate} severity={severity} severityColor={severityColor} />
      <h3
        className="font-heading font-normal text-[1.5rem] leading-[1.2] tracking-[-0.02em] text-[var(--color-foreground)]"
      >
        {title}
      </h3>
      <p
        className="font-body text-base leading-[1.7] text-[var(--color-foreground)]"
      >
        {body}
      </p>
      {mock}
      <blockquote
        className="font-body italic border-l-2 pl-4 text-[var(--color-foreground)]"
        style={{ borderColor: "var(--color-foreground)/40" }}
      >
        {quote}
      </blockquote>
    </Reveal>
  );
}

export function GatesSection() {
  return (
    <section id="gates" className="page-wide py-20 md:py-28 bg-[var(--color-muted)]/30">
      <Reveal>
        <SectionRule number="III" label="Control and safety" />

        <h2
          className="font-heading text-[clamp(2rem,4vw,3.25rem)] leading-[1.1] tracking-[-0.03em] text-[var(--color-foreground)] max-w-3xl"
          style={{ fontWeight: 500 }}
        >
          Three approval gates. Nothing irreversible slips through.
        </h2>

        <p
          className="mt-5 font-heading font-normal text-base md:text-lg leading-[1.6] text-[var(--color-muted-foreground)] max-w-2xl"
        >
          Verify. Publish. Save. Each one asks before the agent does anything you cannot take back. The agent has no access to your home directory, browser profile, or any secrets. You may deny at any time. Affected claims will be marked unverified.
        </p>

        <div className="mt-12 space-y-6 md:space-y-8">
          <GateCard
            gate="VERIFY"
            severity="IRREVERSIBLE"
            severityColor="destructive"
            title="Verify"
            body="Provenance, declared intent, resource budget, sandbox envelope, risk flags, kill switch. Type the repo owner and hold Allow for three seconds before any code runs."
            quote="Type the repo owner. Hold for three seconds."
            mock={
              <div className="border rounded-md p-4" style={{ borderColor: "var(--color-border)" }}>
                <HoldToAllow durationMs={3000} label="Allow" hint="Hold for 3s" />
                <div className="mt-3 flex items-center gap-2">
                  <Pill tone="warn">Expires 5m</Pill>
                  <Pill tone="idle">Sandbox</Pill>
                </div>
              </div>
            }
          />

          <GateCard
            gate="PUBLISH"
            severity="IRREVERSIBLE"
            severityColor="destructive"
            title="Publish"
            body="A diff between the claimed numbers and what Recap actually reproduced. Allow to unlock the markdown export."
            quote="Reproduced 91.7% · claimed 92.4% · Δ −0.7"
            mock={
              <div className="border rounded-md p-4" style={{ borderColor: "var(--color-border)" }}>
                <DiffBar reproduced={91.7} claimed={92.4} delta={-0.7} />
              </div>
            }
          />

          <GateCard
            gate="SAVE"
            severity="REVERSIBLE"
            severityColor="accent"
            title="Save"
            body="Annotations you made while reading. Merge them into the audit, or keep them local."
            quote="Merge. Keep local."
            mock={
              <div className="border rounded-md p-4" style={{ borderColor: "var(--color-border)" }}>
                <SaveToggle />
              </div>
            }
            delay={120}
          />
        </div>
      </Reveal>
    </section>
  );
}