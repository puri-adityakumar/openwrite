// Phase 4.2 — auto-generated risk flags for the Verify gate.
//
// The binding spec (docs/approval-gates.md, G1 #6) requires the
// Verify card to surface **repo-signal** risk flags: presence of
// setup.py, Makefile, `\write18`-style macros, large downloads, and
// network calls. The card must derive these from the payload
// attached to the `tool.approval_required` event — NEVER from LLM
// prose.
//
// The payload shape (set by the verifier upstream) is a JSON blob with
// a `signals` field. We probe the signals here and return a flat list
// of { key, label, present } rows the card can render. If a signal is
// missing, the row renders as "not detected" so the user can see
// every check ran.

export type RiskFlagKey =
  | "setup_py"
  | "makefile"
  | "write18"
  | "large_download"
  | "network_call";

export type RiskFlag = {
  key: RiskFlagKey;
  label: string;
  present: boolean;
  // Optional one-line detail from the payload (e.g. the URL that was
  // about to be downloaded, or the LaTeX package the \write18 macro
  // was targeting).
  detail?: string;
};

// Subset of the gate payload we care about. Anything else is ignored
// — the spec is "derive from repo signals, not LLM prose".
export type RiskSignals = {
  hasSetupPy?: boolean;
  hasMakefile?: boolean;
  hasWrite18?: boolean;
  largeDownload?: { url?: string; bytes?: number } | null;
  hasNetworkCall?: boolean;
};

export type GatePayloadForRisk = {
  signals?: RiskSignals;
};

const ALL: { key: RiskFlagKey; label: string }[] = [
  { key: "setup_py", label: "setup.py present" },
  { key: "makefile", label: "Makefile present" },
  { key: "write18", label: "LaTeX \\write18 macro" },
  { key: "large_download", label: "Large download" },
  { key: "network_call", label: "Network call" },
];

// Derive the flag list from a gate payload. Always returns 5 rows
// (one per signal) so the card can render a stable layout even when
// a signal is missing.
export function deriveRiskFlags(payload: unknown): RiskFlag[] {
  const signals = isRiskPayload(payload) ? payload.signals : undefined;
  return ALL.map(({ key, label }) => {
    switch (key) {
      case "setup_py":
        return { key, label, present: Boolean(signals?.hasSetupPy) };
      case "makefile":
        return { key, label, present: Boolean(signals?.hasMakefile) };
      case "write18":
        return { key, label, present: Boolean(signals?.hasWrite18) };
      case "large_download": {
        const ld = signals?.largeDownload;
        const present = Boolean(ld && (ld.url || ld.bytes));
        const detail = present && ld?.url ? ld.url : undefined;
        return { key, label, present, detail };
      }
      case "network_call":
        return { key, label, present: Boolean(signals?.hasNetworkCall) };
    }
  });
}

function isRiskPayload(x: unknown): x is GatePayloadForRisk {
  return typeof x === "object" && x !== null;
}

// Total flags considered "high risk" — i.e. we'd advise a cautious
// operator to scrutinise the run. The card surfaces this in the
// header next to the countdown.
export function highRiskCount(flags: RiskFlag[]): number {
  return flags.filter((f) => f.present).length;
}
