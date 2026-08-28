import { describe, it, expect } from "vitest";

// Phase 6.3 — `recap init-key` (the power-user path, documented as
// NOT a pre-demo step). The CLI upserts KEY=VALUE entries into .env,
// seeding it from .env.example when .env doesn't exist yet.
//
// The logic is pure (content-in, content-out) so the file I/O stays a
// thin wrapper in cli/init-key.ts.

describe("buildEnvContent — .env upsert", () => {
  it("adds a missing key", async () => {
    const { buildEnvContent } = await import("../cli/init-key");
    const out = buildEnvContent("A=1\n", [["DAYTONA_API_KEY", "dt0na"]]);
    expect(out).toContain("A=1");
    expect(out).toContain("DAYTONA_API_KEY=dt0na");
  });

  it("replaces an existing key's value in place, keeping comments", async () => {
    const { buildEnvContent } = await import("../cli/init-key");
    const existing = [
      "# --- sandbox ---",
      "DAYTONA_API_KEY=replace-me",
      "GMI_API_KEY=replace-me",
      "",
    ].join("\n");
    const out = buildEnvContent(existing, [["DAYTONA_API_KEY", "dt0na"]]);
    expect(out).toContain("DAYTONA_API_KEY=dt0na");
    expect(out).not.toContain("DAYTONA_API_KEY=replace-me");
    // Exactly one DAYTONA line: the value was replaced, not appended.
    expect(out.split("\n").filter((l) => l.startsWith("DAYTONA_API_KEY="))).toHaveLength(1);
    expect(out).toContain("# --- sandbox ---");
    expect(out).toContain("GMI_API_KEY=replace-me");
  });

  it("seeds from .env.example content when .env is missing (null)", async () => {
    const { buildEnvContent } = await import("../cli/init-key");
    const example = "GMI_API_KEY=replace-me\nDAYTONA_API_KEY=replace-me\n";
    const out = buildEnvContent(null, [["DAYTONA_API_KEY", "dt0na"]], example);
    expect(out).toContain("DAYTONA_API_KEY=dt0na");
    expect(out).toContain("GMI_API_KEY=replace-me");
  });

  it("falls back to a minimal header when neither file exists", async () => {
    const { buildEnvContent } = await import("../cli/init-key");
    const out = buildEnvContent(null, [["JWT_SECRET", "s3cret"]]);
    expect(out).toContain("JWT_SECRET=s3cret");
    expect(out).toContain("Recap environment");
  });
});
