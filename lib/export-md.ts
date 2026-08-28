// Phase 5.4 — review markdown assembly (PURE module).
//
// The export renders the mockup's four sections (TL;DR · Claims ↔
// evidence · Reproduction diff · Open questions for the author). The
// Reproduction diff carries the publish gate's Δ line. Missing data
// renders explicit placeholders — never invented numbers.

export type ExportClaim = { text: string; evidence?: string | null; page?: number | null };
export type ExportPublish = { beforeClaimed: number; afterReproduced: number } | null;

export type ExportInput = {
  title: string;
  pageCount: number;
  tldr: string | null;
  claims: ExportClaim[];
  publish: ExportPublish;
  openQuestions: string[];
};

// The publish gate's Δ line (P4 delta): "Reproduced 91.7% (claimed
// 92.4%, Δ −0.7)". Only real numbers render; nothing fabricated.
export function reproductionDeltaLine(publish: ExportPublish): string {
  if (
    !publish ||
    typeof publish.beforeClaimed !== "number" ||
    typeof publish.afterReproduced !== "number"
  ) {
    return "— not published yet —";
  }
  const delta = publish.afterReproduced - publish.beforeClaimed;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `Reproduced ${publish.afterReproduced}% (claimed ${publish.beforeClaimed}%, Δ ${sign}${Math.abs(delta).toFixed(1)})`;
}

// Phase 5.4 — the Review-mode export lock: the download unlocks only
// via an explicit Allow on the publish gate. ANY publish gate that is
// not 'allowed' (pending, denied, or expired — Qodo review round 2:
// waiting out the TTL must not bypass the gate) keeps it locked. No
// publish gate ever created (the seed paper) unlocks it.
export function exportLocked(
  gates: Array<{ kind: string; status: string }>,
): boolean {
  return gates.some((g) => g.kind === "publish" && g.status !== "allowed");
}

export function assembleMarkdown(input: ExportInput): string {
  const lines: string[] = [];
  lines.push(`# ${input.title}`, "");
  lines.push(`Review mode produced ${input.pageCount} pages of markdown.`, "");
  lines.push("## TL;DR", "");
  lines.push(input.tldr ?? "_no TL;DR yet — run the extract step_", "");
  lines.push("## Claims ↔ evidence", "");
  if (input.claims.length === 0) {
    lines.push("_no claims extracted yet_", "");
  } else {
    lines.push("| Claim | Evidence | Page |", "|---|---|---|");
    for (const c of input.claims) {
      lines.push(`| ${c.text} | ${c.evidence ?? "—"} | ${c.page ?? "—"}` + " |");
    }
    lines.push("");
  }
  lines.push("## Reproduction diff", "");
  lines.push(reproductionDeltaLine(input.publish), "");
  lines.push("## Open questions for the author", "");
  if (input.openQuestions.length === 0) {
    lines.push("_no open questions recorded_", "");
  } else {
    for (const q of input.openQuestions) lines.push(`- ${q}`);
    lines.push("");
  }
  return lines.join("\n");
}
