import { describe, it, expect, afterAll } from "vitest";
import { closePool, query } from "../lib/db";

// The audit JSON route returns buildAuditView's rows for the caller's
// own paper, 404 for someone else's, and 401 unauthenticated. Shape is
// exercised through the same lib the /paper/[slug]/audit page uses.

const SEED_PAPER = "00000000-0000-0000-0000-000000000010";

afterAll(async () => {
  await closePool();
});

describe("audit view builder (backs the JSON route)", () => {
  it("returns seed rows for the sessionless seed paper", async () => {
    const { buildAuditView } = await import("../lib/audit-view");
    const view = await buildAuditView(SEED_PAPER);
    expect(view.source).toBe("seed");
    expect(view.rows.length).toBeGreaterThan(0);
    for (const row of view.rows) {
      expect(typeof row.ts).toBe("string");
      expect(typeof row.icon).toBe("string");
      expect(typeof row.message).toBe("string");
    }
  });

  it("returns an empty row set for a paper with no audit data", async () => {
    const { buildAuditView } = await import("../lib/audit-view");
    const missing = await buildAuditView("00000000-0000-0000-0000-00000000dead");
    expect(missing.rows).toEqual([]);
  });
});
