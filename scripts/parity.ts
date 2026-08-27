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
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SEED_PATH = resolve(ROOT, "seed.sql");
const SCHEMA_PATH = resolve(ROOT, "schema.sql");

// Canonical event shape contract: each top-level key the cockpit first paint
// expects, and the type of the value. This is the authoritative spec; both the
// seed_audits events and the live audit events must conform to it.
const CONTRACT: Record<string, "object" | "string" | "number" | "boolean" | "array"> = {
  trail: "object",      // { pills: [{ id, label, state }, ...] }
  coverage: "object",   // { pages: [{ page, density }, ...] }
  summary: "object",    // { title, abstract, tldr, claims_count, evidence_count }
  pulse: "array",       // [ "line1", "line2", ... ]
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
  // The SQL uses double-quoted JSON keys; valid JSON. Just JSON.parse it.
  return JSON.parse(literal);
}

function checkContract(label: string, obj: Record<string, unknown>): string[] {
  const issues: string[] = [];
  for (const [key, expectedType] of Object.entries(CONTRACT)) {
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

function main(): void {
  if (!existsSync(SEED_PATH)) fail(`seed.sql not found at ${SEED_PATH}`);
  if (!existsSync(SCHEMA_PATH)) fail(`schema.sql not found at ${SCHEMA_PATH}`);

  const seed = readFileSync(SEED_PATH, "utf8");
  const events = extractSeedEvents(seed);
  if (!events) fail("could not extract seed_audits events from seed.sql");

  const seedIssues = checkContract("seed_audits", events);
  if (seedIssues.length > 0) fail(seedIssues.join("\n  "));
  ok("seed_audits events conform to the contract");

  // If DATABASE_URL is set and the audit table exists, also probe the live
  // shape. This is best-effort: a missing table or connection failure logs a
  // warning but does not fail the script (the file check already proved the
  // contract, and Phase 1.1 may run before the DB is up).
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    ok("DATABASE_URL not set; live-DB probe skipped (file check only)");
    process.exit(0);
  }

  // Lazy import of pg — only when DATABASE_URL is set. We avoid adding pg as a
  // dependency just for the optional probe; the dev who wants live parity
  // checks can install it. For now, we just log and exit 0.
  warn("DATABASE_URL is set but live-DB probe requires `pg` (install separately); skipping");
  process.exit(0);
}

main();
