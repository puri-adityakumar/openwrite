/**
 * Parity check: seed_audits event shape vs the live audit event shape contract.
 *
 * The cockpit first paint renders from `seed_audits` (no TrueForge call needed).
 * The live path renders from the `audit` table (populated by TrueForge SSE events).
 * If these two shapes drift, the seed first paint will diverge from the live
 * one and judges will see inconsistent UI. This script catches that.
 *
 * Usage:
 *   npm run parity                       # file-only check (no DB needed)
 *   DATABASE_URL=... npm run parity      # also probes the live DB
 *
 * Exit codes:
 *   0 — shape matches the contract; live DB (if probed) is in sync
 *   1 — drift detected (different keys / types between seed and contract)
 *   2 — could not read seed.sql / schema.sql
 *   3 — DATABASE_URL was set but the live DB probe failed
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SEED_PATH = resolve(ROOT, "seed.sql");
const SCHEMA_PATH = resolve(ROOT, "schema.sql");

// Canonical event shape contract. Each top-level key has a primitive type
// AND a nested-shape spec the cockpit actually depends on (drift guard).
// Top-level contract:
const TOP_LEVEL: Record<string, "object" | "string" | "number" | "boolean" | "array"> = {
  trail: "object",    // { pills: [{ id, label, state }, ...] }
  coverage: "object", // { pages: [{ page, density }, ...] }
  summary: "object",  // { title, abstract, tldr, claims_count, evidence_count }
  pulse: "array",     // [ "line1", "line2", ... ]
};

// Nested contract: which keys must be present inside each top-level object,
// and what their primitive type is. A "string" / "number" value asserts the
// type of the scalar; an "array" asserts the array's element shape.
const NESTED_OBJECT: Record<string, Record<string, "string" | "number" | "array" | "object">> = {
  trail: {
    pills: "array", // array of { id: string, label: string, state: string }
  },
  coverage: {
    pages: "array", // array of { page: number, density: number }
  },
  summary: {
    title: "string",
    abstract: "string",
    tldr: "string",
    claims_count: "number",
    evidence_count: "number",
  },
};

const NESTED_ELEMENT: Record<string, Record<string, Record<string, "string" | "number">>> = {
  trail: {
    pills: { id: "string", label: "string", state: "string" },
  },
  coverage: {
    pages: { page: "number", density: "number" },
  },
};

function fail(msg: string): never {
  console.error(`parity: FAIL — ${msg}`);
  process.exit(1);
}

function warn(msg: string): void {
  console.warn(`parity: WARN — ${msg}`);
}

function ok(msg: string): void {
  console.log(`parity: OK   — ${msg}`);
}

function extractSeedEvents(sql: string): Record<string, unknown> | null {
  // Find the first INSERT INTO seed_audits ... VALUES ( '<json>'::jsonb )
  // and parse the JSON literal. We use a greedy match for the first '{' through
  // the matching '}' — sufficient for our hand-authored seed.
  const marker = "insert into seed_audits";
  const lower = sql.toLowerCase();
  const idx = lower.indexOf(marker);
  if (idx === -1) {
    fail("no `INSERT INTO seed_audits` found in seed.sql");
  }
  // Find the first '{' after the VALUES keyword.
  const after = sql.slice(idx);
  const valuesIdx = after.toLowerCase().indexOf("values");
  if (valuesIdx === -1) fail("no VALUES clause in seed_audits insert");
  const jsonStart = after.indexOf("{", valuesIdx);
  if (jsonStart === -1) fail("no JSON object literal in seed_audits insert");

  // Walk braces to find the matching close.
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;
  for (let i = jsonStart; i < after.length; i++) {
    const ch = after[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === "'") { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end === -1) fail("unterminated JSON literal in seed_audits insert");
  const literal = after.slice(jsonStart, end + 1);
  return JSON.parse(literal);
}

function checkTopLevel(label: string, obj: Record<string, unknown>): string[] {
  const issues: string[] = [];
  for (const [key, expectedType] of Object.entries(TOP_LEVEL)) {
    if (!(key in obj)) {
      issues.push(`${label}: missing required key '${key}'`);
      continue;
    }
    const v = obj[key];
    if (v === null || v === undefined) {
      issues.push(`${label}: key '${key}' is null/undefined`);
      continue;
    }
    const actualType = Array.isArray(v) ? "array" : typeof v;
    if (actualType !== expectedType) {
      issues.push(`${label}: key '${key}' has type '${actualType}', expected '${expectedType}'`);
    }
  }
  return issues;
}

function checkNested(label: string, obj: Record<string, unknown>): string[] {
  const issues: string[] = [];
  for (const [topKey, nestedSpec] of Object.entries(NESTED_OBJECT)) {
    const top = obj[topKey] as Record<string, unknown> | undefined;
    if (top === null || typeof top !== "object" || Array.isArray(top)) {
      // Already flagged at top level; skip here.
      continue;
    }
    for (const [k, expectedType] of Object.entries(nestedSpec)) {
      if (!(k in top)) {
        issues.push(`${label}: ${topKey} missing required nested key '${k}'`);
        continue;
      }
      const v = top[k];
      if (v === null || v === undefined) {
        issues.push(`${label}: ${topKey}.${k} is null/undefined`);
        continue;
      }
      const actualType = Array.isArray(v) ? "array" : typeof v;
      if (actualType !== expectedType) {
        issues.push(`${label}: ${topKey}.${k} has type '${actualType}', expected '${expectedType}'`);
      }
    }
    // Drill into element shapes for arrays.
    const elementSpec = NESTED_ELEMENT[topKey];
    for (const [arrKey, elemSpec] of Object.entries(elementSpec ?? {})) {
      const arr = top[arrKey];
      if (!Array.isArray(arr)) continue;
      for (let i = 0; i < arr.length; i++) {
        const el = arr[i];
        if (el === null || typeof el !== "object" || Array.isArray(el)) {
          issues.push(`${label}: ${topKey}.${arrKey}[${i}] is not an object`);
          continue;
        }
        for (const [ek, et] of Object.entries(elemSpec)) {
          if (!(ek in (el as Record<string, unknown>))) {
            issues.push(`${label}: ${topKey}.${arrKey}[${i}] missing required key '${ek}'`);
            continue;
          }
          const ev = (el as Record<string, unknown>)[ek];
          const actual = typeof ev;
          if (actual !== et) {
            issues.push(`${label}: ${topKey}.${arrKey}[${i}].${ek} has type '${actual}', expected '${et}'`);
          }
        }
      }
    }
  }
  return issues;
}

function checkContract(label: string, obj: Record<string, unknown>): string[] {
  return [...checkTopLevel(label, obj), ...checkNested(label, obj)];
}

async function probeLive(dbUrl: string, seedEvents: Record<string, unknown>): Promise<void> {
  const client = new pg.Client({ connectionString: dbUrl });
  try {
    await client.connect();
  } catch (err) {
    console.error(`parity: FAIL — could not connect to live DB: ${(err as Error).message}`);
    process.exit(3);
  }
  try {
    // Probe seed_audits (this is what the cockpit first paint actually reads).
    const seedRes = await client.query(
      "SELECT events FROM seed_audits ORDER BY id ASC LIMIT 1",
    );
    if (seedRes.rowCount === 0) {
      fail("live DB: seed_audits is empty — seed.sql was not applied");
    }
    const liveSeedEvents = seedRes.rows[0].events;
    if (typeof liveSeedEvents !== "object" || liveSeedEvents === null) {
      fail(`live DB: seed_audits.events has unexpected type '${typeof liveSeedEvents}'`);
    }
    const liveSeedIssues = checkContract("live seed_audits", liveSeedEvents as Record<string, unknown>);
    if (liveSeedIssues.length > 0) fail(`live DB drift:\n  ${liveSeedIssues.join("\n  ")}`);

    // Probe the live audit table IF it has any rows. The contract is the same;
    // we just verify the shape of any present event matches the contract.
    const auditRes = await client.query("SELECT events FROM audit LIMIT 1");
    if (auditRes.rowCount > 0) {
      const liveAudit = auditRes.rows[0].events;
      if (typeof liveAudit !== "object" || liveAudit === null) {
        fail(`live DB: audit.events has unexpected type '${typeof liveAudit}'`);
      }
      const liveAuditIssues = checkContract("live audit", liveAudit as Record<string, unknown>);
      if (liveAuditIssues.length > 0) fail(`live audit drift:\n  ${liveAuditIssues.join("\n  ")}`);
    } else {
      ok("live audit table is empty (no TrueForge run yet); skipping audit row probe");
    }

    // Drift guard: top-level keys of live seed_audits must match the file seed_audits.
    const liveKeys = Object.keys(liveSeedEvents as Record<string, unknown>).sort();
    const fileKeys = Object.keys(seedEvents).sort();
    if (JSON.stringify(liveKeys) !== JSON.stringify(fileKeys)) {
      fail(`live seed_audits keys (${liveKeys.join(",")}) do not match file seed_audits keys (${fileKeys.join(",")})`);
    }
    ok("live DB is in sync with the contract");
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  if (!existsSync(SEED_PATH)) fail(`seed.sql not found at ${SEED_PATH}`);
  if (!existsSync(SCHEMA_PATH)) fail(`schema.sql not found at ${SCHEMA_PATH}`);

  const seed = readFileSync(SEED_PATH, "utf8");
  const events = extractSeedEvents(seed);
  if (!events) fail("could not extract seed_audits events from seed.sql");

  const seedIssues = checkContract("seed_audits", events);
  if (seedIssues.length > 0) fail(seedIssues.join("\n  "));
  ok("seed_audits events conform to the contract (top-level + nested)");

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    ok("DATABASE_URL not set; live-DB probe skipped (file check only)");
    process.exit(0);
  }
  await probeLive(dbUrl, events);
}

main().catch((err) => {
  console.error(`parity: FAIL — unhandled error: ${(err as Error).stack ?? (err as Error).message}`);
  process.exit(1);
});
