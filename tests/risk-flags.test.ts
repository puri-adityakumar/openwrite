import { describe, it, expect } from "vitest";
import { deriveRiskFlags, highRiskCount } from "../lib/risk-flags";

// Phase 4.2 — risk flags derive from payload.signals, not LLM prose.

describe("deriveRiskFlags", () => {
  it("returns all 5 rows for a known payload", () => {
    const flags = deriveRiskFlags({
      signals: {
        hasSetupPy: true,
        hasMakefile: false,
        hasWrite18: false,
        largeDownload: null,
        hasNetworkCall: true,
      },
    });
    expect(flags).toHaveLength(5);
    expect(flags.find((f) => f.key === "setup_py")?.present).toBe(true);
    expect(flags.find((f) => f.key === "makefile")?.present).toBe(false);
    expect(flags.find((f) => f.key === "write18")?.present).toBe(false);
    expect(flags.find((f) => f.key === "large_download")?.present).toBe(false);
    expect(flags.find((f) => f.key === "network_call")?.present).toBe(true);
  });

  it("marks large_download as present when only a URL is supplied", () => {
    const flags = deriveRiskFlags({
      signals: { largeDownload: { url: "https://example.com/data.tar.gz" } },
    });
    expect(flags.find((f) => f.key === "large_download")?.present).toBe(true);
    expect(flags.find((f) => f.key === "large_download")?.detail).toBe("https://example.com/data.tar.gz");
  });

  it("returns all-not-present for an empty / missing payload", () => {
    const flags = deriveRiskFlags({});
    expect(flags).toHaveLength(5);
    expect(flags.every((f) => f.present === false)).toBe(true);
  });

  it("highRiskCount returns the number of present flags", () => {
    const flags = deriveRiskFlags({
      signals: { hasSetupPy: true, hasMakefile: true, hasNetworkCall: true },
    });
    expect(highRiskCount(flags)).toBe(3);
  });
});
