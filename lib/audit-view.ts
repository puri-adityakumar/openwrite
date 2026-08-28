// Phase 5.2 — audit view builder. Reads the live `audit` rows when the
// paper has any, else the seed_audits first-paint payload, and maps
// both into the shared AuditRow shape so every consumer (the page,
// the JSON route) renders either source identically.

import { query } from "./db";
import {
  rowsFromLiveEvents,
  rowsFromSeedEvents,
  auditFooter,
  type AuditRow,
} from "./audit-rows";
import type { SeedEvents } from "../components/Cockpit";

type LiveRow = { events: unknown };
type SeedRow = { events: SeedEvents };

export async function buildAuditView(paperId: string): Promise<{
  source: "live" | "seed";
  rows: AuditRow[];
  footer: string;
}> {
  // Source selection mirrors the cockpit split: a paper with a session
  // renders its live audit rows; a sessionless paper renders the
  // seed_audits first-paint payload. (Stray audit rows for the seed
  // paper — e.g. from unit-test fixtures — must not drown the seed.)
  const paper = await query<{ session_id: string | null }>(
    `SELECT session_id FROM papers WHERE id = $1 LIMIT 1`,
    [paperId],
  );
  if ((paper.rows[0]?.session_id ?? null) !== null) {
    const live = await query<LiveRow>(
      `SELECT events FROM audit WHERE paper_id = $1 ORDER BY id ASC`,
      [paperId],
    );
    const events = live.rows.map((r) => r.events as Record<string, unknown>);
    return { source: "live", rows: rowsFromLiveEvents(events), footer: auditFooter(events) };
  }
  const seed = await query<SeedRow>(
    `SELECT events FROM seed_audits WHERE paper_id = $1 LIMIT 1`,
    [paperId],
  );
  const seedEvents = seed.rows[0]?.events;
  return {
    source: "seed",
    rows: seedEvents ? rowsFromSeedEvents(seedEvents) : [],
    footer: auditFooter([]),
  };
}
