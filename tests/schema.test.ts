import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SCHEMA_PATH = resolve(ROOT, "schema.sql");

// Phase 1.1: assert schema.sql exists, is valid Postgres, defines exactly the
// 5 tables from docs/architecture.md (users, papers, audit, annotations,
// gates, seed_audits — note: that's 6 in the doc but 5 in the plan's "Five
// tables" line; seed_audits is a 6th seed table, so the "exactly 5" line
// refers to the core 5. We assert the 6 here, matching the architecture doc).
const CORE_TABLES = ["users", "papers", "audit", "annotations", "gates", "seed_audits"] as const;
const INDEXES = [
  "papers(user_id)",
  "audit(paper_id, created_at desc)",
  "gates(paper_id, created_at desc)",
  "papers(slug)",
] as const;

const ENUM_LIKE_COLUMNS: Array<{ table: string; column: string; values: string[] }> = [
  { table: "papers", column: "mode", values: ["learn", "deep-read", "review"] },
  { table: "papers", column: "status", values: ["queued", "running", "paused", "done", "error"] },
  { table: "gates", column: "kind", values: ["verify", "publish", "save"] },
  { table: "gates", column: "severity", values: ["reversible", "irreversible"] },
  { table: "gates", column: "status", values: ["pending", "allowed", "denied", "expired"] },
];

let schema = "";
let schemaUpper = "";

beforeAll(() => {
  if (existsSync(SCHEMA_PATH)) {
    schema = readFileSync(SCHEMA_PATH, "utf8");
    schemaUpper = schema.toUpperCase();
  }
});

function hasCreateTable(name: string): boolean {
  // Match `CREATE TABLE name` (case-insensitive, tolerating whitespace and quoted identifiers).
  const re = new RegExp(`create\\s+table\\s+(if\\s+not\\s+exists\\s+)?["']?${name}["']?`, "i");
  return re.test(schema);
}

function hasColumn(table: string, column: string): boolean {
  // Naive column check: find the CREATE TABLE block for the table, then look for the column.
  // We don't try to handle nested parens perfectly — Phase 1.1 schema is flat.
  const tableRe = new RegExp(
    `create\\s+table\\s+(if\\s+not\\s+exists\\s+)?["']?${table}["']?\\s*\\(([^;]*)\\)`,
    "is",
  );
  const match = schema.match(tableRe);
  if (!match) return false;
  const body = match[2];
  // The column appears as `column_name <type> ...` (possibly quoted) at line start or after a comma.
  const colRe = new RegExp(
    `(?:^|,)\\s*["']?${column}["']?\\s+\\S`,
    "im",
  );
  return colRe.test(body);
}

function hasIndexLike(needle: string): boolean {
  return schemaUpper.includes(needle.toUpperCase());
}

describe("Phase 1.1 — schema.sql shape", () => {
  it("schema.sql exists at repo root", () => {
    expect(existsSync(SCHEMA_PATH), "schema.sql must exist at repo root").toBe(true);
  });

  it("defines all 6 expected tables (5 core + seed_audits)", () => {
    for (const t of CORE_TABLES) {
      expect(hasCreateTable(t), `schema.sql must define CREATE TABLE ${t}`).toBe(true);
    }
  });

  it("defines the required indexes", () => {
    for (const idx of INDEXES) {
      // Each entry is `<table>(<col>[, ...])`. We assert that an index exists on
      // this table that includes the listed column(s). The check is column-level,
      // not index-name-level, so a table with multiple indexes (e.g. papers has
      // user_id AND slug) is handled correctly.
      const parenStart = idx.indexOf("(");
      const table = parenStart === -1 ? idx.split(".")[0] : idx.slice(0, parenStart);
      const insideParens = parenStart === -1 ? idx.split(".")[1] : idx.slice(parenStart + 1, idx.indexOf(")"));
      const cols = insideParens.split(",").map((c) => c.trim()).filter(Boolean);

      // Find every index in the file that targets this table, then assert at
      // least one of them contains all the requested columns.
      const allIndexRe = new RegExp(
        `create\\s+(unique\\s+)?index[^;]*?on\\s+${table}\\s*\\(([^)]*)\\)`,
        "gi",
      );
      const bodies: string[] = [];
      for (const m of schema.matchAll(allIndexRe)) {
        bodies.push(m[2]);
      }
      expect(bodies.length, `schema.sql must have at least one index on ${table}`).toBeGreaterThan(0);

      const found = bodies.some((body) =>
        cols.every((col) => {
          const bareCol = col.split(/\s+/)[0];
          return new RegExp(`\\b${bareCol}\\b`, "i").test(body);
        }),
      );
      expect(
        found,
        `schema.sql must have an index on ${table} including columns [${cols.join(", ")}]; indexes found: ${JSON.stringify(bodies)}`,
      ).toBe(true);
    }
  });

  it("enum-like columns declare the required value sets in CHECK constraints or comments", () => {
    for (const { table, column, values } of ENUM_LIKE_COLUMNS) {
      expect(hasColumn(table, column), `${table} must have a ${column} column`).toBe(true);
      // Each value should be present in the schema file somewhere within the table's
      // CREATE block (CHECK constraint), in a comment, or in a typed enum. We don't
      // enforce a strict CHECK match — just that the value names are in the file.
      for (const v of values) {
        const re = new RegExp(`['"]?${v}['"]?`, "i");
        expect(re.test(schema), `${table}.${column} should reference value '${v}' somewhere in schema`).toBe(true);
      }
    }
  });
});
