import { describe, it, expect } from "vitest";

// Phase 5.4 — review markdown assembly + publish-gate lock.
//
//   assembleMarkdown renders the mockup's 4 sections (TL;DR · Claims ↔
//   evidence · Reproduction diff · Open questions for the author) with
//   the Δ line from the publish-gate payload. Missing data renders "—"
//   placeholders, never invented numbers (Qodo #11 spirit).
//
//   exportLocked: the Review-mode export is locked while a publish
//   gate exists in pending or denied state; no publish gate ever
//   created (seed paper) or an allowed one unlocks the download.

describe("assembleMarkdown — the 4 mockup sections", () => {
  it("renders all four sections with the Δ line from the publish payload", async () => {
    const { assembleMarkdown } = await import("../lib/export-md");
    const md = assembleMarkdown({
      title: "Attention Is All You Need",
      pageCount: 10,
      tldr: "Replace RNN/CNN sequence models with pure attention.",
      claims: [
        { text: "Multi-head attention beats recurrence", evidence: "Table 2, BLEU 28.4", page: 5 },
        { text: "Training is fully parallelizable", evidence: "Figure 1, wall-clock", page: 6 },
      ],
      publish: { beforeClaimed: 92.4, afterReproduced: 91.7 },
      openQuestions: ["How sensitive is performance to the number of attention heads?"],
    });
    expect(md).toContain("# Attention Is All You Need");
    expect(md).toContain("Review mode produced 10 pages of markdown.");
    expect(md).toContain("## TL;DR");
    expect(md).toContain("Replace RNN/CNN sequence models with pure attention.");
    expect(md).toContain("## Claims ↔ evidence");
    expect(md).toContain("Multi-head attention beats recurrence");
    expect(md).toContain("Table 2, BLEU 28.4");
    expect(md).toContain("## Reproduction diff");
    expect(md).toContain("Reproduced 91.7% (claimed 92.4%, Δ −0.7)");
    expect(md).toContain("## Open questions for the author");
    expect(md).toContain("How sensitive is performance to the number of attention heads?");
  });

  it("missing reproduction data renders a placeholder, never a fake Δ", async () => {
    const { assembleMarkdown } = await import("../lib/export-md");
    const md = assembleMarkdown({
      title: "T",
      pageCount: 0,
      tldr: null,
      claims: [],
      publish: null,
      openQuestions: [],
    });
    expect(md).toContain("Review mode produced 0 pages of markdown.");
    expect(md).toContain("## Reproduction diff");
    expect(md).toContain("— not published yet —");
    expect(md).not.toMatch(/Δ -?\d/);
    expect(md).toContain("_no claims extracted yet_");
    expect(md).toContain("_no open questions recorded_");
  });
});

describe("exportLocked — the publish-gate lock", () => {
  it("is locked while a publish gate is pending or denied", async () => {
    const { exportLocked } = await import("../lib/export-md");
    expect(
      exportLocked([{ kind: "publish", status: "pending" }]),
    ).toBe(true);
    expect(
      exportLocked([{ kind: "publish", status: "denied" }]),
    ).toBe(true);
  });

  it("is unlocked with an allowed publish gate or no publish gate at all", async () => {
    const { exportLocked } = await import("../lib/export-md");
    expect(exportLocked([{ kind: "publish", status: "allowed" }])).toBe(false);
    // The seed paper: no gates were ever created.
    expect(exportLocked([])).toBe(false);
    // A verify gate is irrelevant to the export lock.
    expect(exportLocked([{ kind: "verify", status: "pending" }])).toBe(false);
  });
});

describe("exportLocked — expired publish gate (Qodo review round 2)", () => {
  it("an expired publish gate does NOT unlock the export", async () => {
    const { exportLocked } = await import("../lib/export-md");
    // Waiting out the TTL must not be a bypass: only an explicit
    // Allow unlocks the download.
    expect(exportLocked([{ kind: "publish", status: "expired" }])).toBe(true);
  });
});
