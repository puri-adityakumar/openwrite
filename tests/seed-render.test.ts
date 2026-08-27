import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Phase 1.3 — seed-render shape tests (RED first, then GREEN with the
// /paper/[slug] page and the seed_audits shape from seed.sql).
//
// These tests pin the JSON shape the cockpit renders from so that drift in
// seed.sql or the renderer breaks the build, not the demo. The same shape
// is enforced live by `npm run parity` against the database; here we
// assert the **file** shape so a PR that changes the seed without
// updating the renderers (or vice versa) is caught by unit tests.

const ROOT = resolve(__dirname, "..");
const SEED_PATH = resolve(ROOT, "seed.sql");

type Pill = { id: string; label: string; state: string };
type Page = { page: number; density: number };
type Summary = { title: string; abstract: string; tldr: string; claims_count: number; evidence_count: number };
type SeedEvents = {
  trail: { pills: Pill[] };
  coverage: { pages: Page[] };
  summary: Summary;
  pulse: string[];
};

// Tiny SQL -> JSON extractor: pulls the first `'{...}'::jsonb` literal out
// of the seed_audits INSERT so we can assert against it without spinning up
// a Postgres connection. The seed file is author-controlled so a regex is
// safe here.
function loadSeedEvents(): SeedEvents {
  const sql = readFileSync(SEED_PATH, "utf8");
  const m = sql.match(/VALUES \(\s*\([\s\S]*?'(\{[\s\S]*?\})'::jsonb\s*\)/);
  if (!m) throw new Error("seed_audits JSON literal not found in seed.sql");
  return JSON.parse(m[1]) as SeedEvents;
}

describe("seed_audits first-paint shape", () => {
  const events = loadSeedEvents();

  it("has the four cockpit surfaces", () => {
    expect(events.trail).toBeDefined();
    expect(events.coverage).toBeDefined();
    expect(events.summary).toBeDefined();
    expect(events.pulse).toBeDefined();
  });

  it("trail has exactly 6 pills, all in 'done' state (plan: Trail all green)", () => {
    expect(events.trail.pills).toHaveLength(6);
    for (const p of events.trail.pills) {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.state).toBe("done");
    }
  });

  it("coverage has 10 page density cells with values in [0, 1]", () => {
    expect(events.coverage.pages).toHaveLength(10);
    for (const c of events.coverage.pages) {
      expect(c.page).toBeGreaterThan(0);
      expect(c.density).toBeGreaterThanOrEqual(0);
      expect(c.density).toBeLessThanOrEqual(1);
    }
  });

  it("summary has title, abstract, tldr, claims_count, evidence_count", () => {
    expect(events.summary.title).toBe("Attention Is All You Need");
    expect(events.summary.abstract).toMatch(/attention/i);
    expect(events.summary.tldr).toMatch(/attention/i);
    expect(events.summary.claims_count).toBeGreaterThan(0);
    expect(events.summary.evidence_count).toBeGreaterThan(0);
  });

  it("pulse has exactly 5 lines (plan: 5-line Pulse inspector)", () => {
    expect(events.pulse).toHaveLength(5);
    for (const line of events.pulse) {
      expect(typeof line).toBe("string");
      expect(line.length).toBeGreaterThan(0);
    }
  });
});
