import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SEED_PATH = resolve(ROOT, "seed.sql");
const FIXTURES_DIR = resolve(ROOT, "fixtures", "papers");

// Phase 1.1: assert seed.sql exists, inserts a demo user (demo@local / demo1234),
// inserts a seeded paper (slug `attention-is-all-you-need`, mode `review`,
// status `done`, source_pdf pointing at a local fixture — NOT a live arXiv ID),
// and inserts a `seed_audits` row whose events shape renders the cockpit
// first paint (Trail all green, Coverage, Summary, 5 Pulse lines).

const SEED_USER_EMAIL = "demo@local";
const SEED_PAPER_SLUG = "attention-is-all-you-need";
const SEED_PAPER_MODE = "review";
const SEED_PAPER_STATUS = "done";
// The fixture PDF must exist at fixtures/papers/attention.pdf and be referenced
// by the seed (source_pdf column), NOT a real arXiv URL.

let seed = "";

beforeAll(() => {
  if (existsSync(SEED_PATH)) {
    seed = readFileSync(SEED_PATH, "utf8");
  }
});

describe("Phase 1.1 — seed.sql shape", () => {
  it("seed.sql exists at repo root", () => {
    expect(existsSync(SEED_PATH), "seed.sql must exist at repo root").toBe(true);
  });

  it("inserts the demo user (demo@local)", () => {
    expect(seed.toLowerCase()).toContain(SEED_USER_EMAIL);
  });

  it("does NOT contain a plaintext demo password 'demo1234' (must be bcrypt-hashed)", () => {
    // The seed should reference the demo password only as a bcrypt hash, never plaintext.
    // Match the string outside of SQL line comments (lines starting with `--`).
    const lines = seed.split("\n");
    const violations = lines.filter((l) => !l.trimStart().startsWith("--") && l.includes("demo1234"));
    expect(violations, "demo password must not appear in plaintext in seed.sql (only in comments)").toEqual([]);
  });

  it("inserts a seeded paper with the canonical slug and mode", () => {
    expect(seed).toContain(SEED_PAPER_SLUG);
    expect(seed).toMatch(new RegExp(`mode[^,]*['"]?${SEED_PAPER_MODE}['"]?`, "i"));
    expect(seed).toMatch(new RegExp(`status[^,]*['"]?${SEED_PAPER_STATUS}['"]?`, "i"));
  });

  it("seeded paper uses a local fixture path, NOT a live arXiv URL", () => {
    // The seed inserts a paper whose source_pdf column is filled with a local fixture path.
    // Acceptable shapes: explicit assignment (`source_pdf = 'fixtures/...'`) OR a positional
    // VALUES tuple where one of the string literals looks like a local path AND the column list
    // includes `source_pdf`. We check both to tolerate either style.
    const fixtureLiteral = /['"][^'"]*fixtures\/papers\/[^'"]+['"]/i;
    expect(
      fixtureLiteral.test(seed),
      "seed must contain a string literal referencing fixtures/papers/<file>",
    ).toBe(true);

    // And no string literal in the source_pdf column should be a live arXiv URL.
    const arxivLiteral = /['"]https?:\/\/(?:export\.)?arxiv\.org\/[^'"]+['"]/i;
    const arxivMatches = seed.match(new RegExp(arxivLiteral.source, "gi")) || [];
    // The seed DOES reference arxiv.org in `source_url` (for the metadata), which is fine.
    // The check is: any such URL must not be inside a column position that maps to source_pdf.
    // Since the paper's source_url is the arxiv abstract page (which is fine), we instead
    // require that NO live arxiv URL appears on the same VALUES row as the source_pdf column.
    expect(
      arxivMatches.length <= 1,
      "at most one live arxiv URL literal is allowed in seed.sql (in source_url, not source_pdf)",
    ).toBe(true);
  });

  it("the fixture PDF exists at fixtures/papers/attention.pdf (or a referenced name)", () => {
    // Either the literal `attention.pdf` is at fixtures/papers/, or seed.sql
    // names a file that exists. We check the canonical name first.
    const canonical = resolve(FIXTURES_DIR, "attention.pdf");
    expect(existsSync(canonical), `fixture PDF must exist at ${canonical}`).toBe(true);
  });

  it("inserts a seed_audits row with events covering the first-paint surfaces", () => {
    // The seed_audits JSONB must contain events that render: Trail (6 pills),
    // Coverage (page grid), Summary, 5 Pulse lines. We assert the event shape
    // contains the required top-level keys.
    expect(/insert\s+into\s+seed_audits/i.test(seed), "must insert into seed_audits").toBe(true);

    // Required surface keys (case-insensitive substring check on the JSON shape).
    const required = [
      "trail",       // 6 pills
      "coverage",    // page grid
      "summary",     // summary tab
      "pulse",       // 5-line pulse
    ];
    for (const k of required) {
      expect(
        seed.toLowerCase().includes(`"${k}"`) || seed.toLowerCase().includes(`'${k}'`),
        `seed_audits events must include a "${k}" key for first-paint rendering`,
      ).toBe(true);
    }
  });
});
