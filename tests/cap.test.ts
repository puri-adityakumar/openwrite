import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { query, closePool } from "../lib/db";

// Phase 5.1 — cap guard tests.
//
//   1. `capExceeded` (pure): cost cap governs when the provider reports
//      a real cost; the token cap governs the custom provider
//      (total_cost_in_usd === 0 — the "Cost —" rule).
//   2. `capChip` (pure): the status-row chip label + red state.
//   3. `enforceCap`: the stream-side hard stop — flips the paper to
//      done + halted with halt_reason 'cap' and writes the audit row.

describe("capExceeded — pure budget guard", () => {
  it("no cap set -> never exceeded", async () => {
    const { capExceeded } = await import("../lib/cap");
    expect(
      capExceeded({ capUsd: null, capTokens: null }, { totalTokens: 99_999, totalCostInUsd: 5 }),
    ).toBe(false);
  });

  it("cost cap governs when cost is real", async () => {
    const { capExceeded } = await import("../lib/cap");
    const cap = { capUsd: 0.012, capTokens: null };
    expect(capExceeded(cap, { totalTokens: 1, totalCostInUsd: 0.013 })).toBe(true);
    expect(capExceeded(cap, { totalTokens: 99_999, totalCostInUsd: 0.011 })).toBe(false);
  });

  it("token cap governs the custom provider (cost === 0, the '—' rule)", async () => {
    const { capExceeded } = await import("../lib/cap");
    const cap = { capUsd: null, capTokens: 10_000 };
    expect(capExceeded(cap, { totalTokens: 10_000, totalCostInUsd: 0 })).toBe(true);
    expect(capExceeded(cap, { totalTokens: 18_402, totalCostInUsd: 0 })).toBe(true);
    expect(capExceeded(cap, { totalTokens: 9_999, totalCostInUsd: 0 })).toBe(false);
  });

  it("with both caps set, either trigger exceeds", async () => {
    const { capExceeded } = await import("../lib/cap");
    const cap = { capUsd: 0.5, capTokens: 10_000 };
    expect(capExceeded(cap, { totalTokens: 20_000, totalCostInUsd: 0 })).toBe(true);
    expect(capExceeded(cap, { totalTokens: 20, totalCostInUsd: 0.6 })).toBe(true);
    expect(capExceeded(cap, { totalTokens: 20, totalCostInUsd: 0.1 })).toBe(false);
  });
});

describe("capChip — status-row chip state", () => {
  it("renders the plain chip when no cap is configured", async () => {
    const { capChip } = await import("../lib/cap");
    const chip = capChip(
      { capUsd: null, capTokens: null },
      { totalTokens: 18_402, costDisplay: "—" },
    );
    expect(chip.active).toBe(false);
    expect(chip.exceeded).toBe(false);
    expect(chip.label).toBe("—");
  });

  it("token cap shows the token usage and goes red on exceed", async () => {
    const { capChip } = await import("../lib/cap");
    const cap = { capUsd: null, capTokens: 10_000 };
    const ok = capChip(cap, { totalTokens: 5_000, costDisplay: "—" });
    expect(ok.active).toBe(true);
    expect(ok.exceeded).toBe(false);
    expect(ok.label).toContain("5,000");
    const red = capChip(cap, { totalTokens: 18_402, costDisplay: "—" });
    expect(red.exceeded).toBe(true);
    expect(red.label).toContain("18,402");
  });

  it("cost cap shows the cost display ('—' rule respected)", async () => {
    const { capChip } = await import("../lib/cap");
    const chip = capChip(
      { capUsd: 0.012, capTokens: null },
      { totalTokens: 1_000, costDisplay: "$0.012" },
    );
    expect(chip.active).toBe(true);
    expect(chip.exceeded).toBe(true);
    expect(chip.label).toBe("$0.012");
  });
});

describe("enforceCap — stream-side hard stop", () => {
  // Dedicated fixture papers — NEVER the seed paper (…010): these
  // tests mutate status/halt/cap columns. Cascade-deleted in afterAll.
  // (…012 belongs to halt.test; parallel files must not share rows.)
  const PAPER_ID = "00000000-0000-0000-0000-000000000013";
  const FAKE_PAPER = "00000000-0000-0000-0000-000000000011"; // cap no-op playground

  beforeAll(async () => {
    await query(
      `INSERT INTO papers (id, user_id, slug, mode, status)
       SELECT p.id, u.id, p.slug, 'review', 'running'
       FROM (VALUES
         ('00000000-0000-0000-0000-000000000011'::uuid, 'cap-playground'),
         ('00000000-0000-0000-0000-000000000013'::uuid, 'cap-stop-playground')
       ) AS p(id, slug)
       CROSS JOIN (SELECT id FROM users WHERE email = 'demo@local') u
       ON CONFLICT (id) DO NOTHING`,
    );
  });

  async function setPaper(id: string, cols: string) {
    await query(
      `UPDATE papers SET status = 'running', halted = false, halt_reason = NULL${cols}
       WHERE id = $1`,
      [id],
    );
  }

  it("writes the cap audit row, halts the paper and locks it (halt_reason 'cap')", async () => {
    const { enforceCap } = await import("../lib/cap-server");
    await setPaper(PAPER_ID, ", cap_tokens = 10000");
    const stopped = await enforceCap(PAPER_ID, { totalTokens: 18_402, totalCostInUsd: 0 });
    expect(stopped).toBe(true);
    const s = await query<{ status: string; halted: boolean; halt_reason: string | null }>(
      `SELECT status, halted, halt_reason FROM papers WHERE id = $1`,
      [PAPER_ID],
    );
    expect(s.rows[0]).toMatchObject({ status: "done", halted: true, halt_reason: "cap" });
    const rows = await query<{ type: string }>(
      `SELECT events->>'type' AS type FROM audit
       WHERE paper_id = $1 AND events->>'type' = 'cap.exceeded'`,
      [PAPER_ID],
    );
    expect(rows.rows.length).toBeGreaterThan(0);
    // Cleanup: restore the fixture's cap so later tests are clean.
    await setPaper(PAPER_ID, ", cap_tokens = NULL");
  });

  it("is a no-op when no cap is configured", async () => {
    const { enforceCap } = await import("../lib/cap-server");
    await setPaper(FAKE_PAPER, "");
    const stopped = await enforceCap(FAKE_PAPER, { totalTokens: 999_999, totalCostInUsd: 9 });
    expect(stopped).toBe(false);
  });

  it("is a no-op when usage is under the cap", async () => {
    const { enforceCap } = await import("../lib/cap-server");
    await setPaper(PAPER_ID, ", cap_tokens = 10000");
    const stopped = await enforceCap(PAPER_ID, { totalTokens: 42, totalCostInUsd: 0 });
    expect(stopped).toBe(false);
    await setPaper(PAPER_ID, ", cap_tokens = NULL");
  });
});

afterAll(async () => {
  // Cascade-deletes the fixtures' audit rows too.
  await query(`DELETE FROM papers WHERE id IN ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000013')`);
  await closePool();
});
