# Phase 5 — Halt 2-State, Audit Page, Replay, Export

**Schedule:** Fri PM, 4 h.
**Day deliverable:** `/paper/:slug/audit` shows the full event log; "Replay
this audit" creates a new session with a fresh sandbox.

## Goal

Control surfaces complete: Halt cycles Pause → Stop, the Cap chip guards
budget, the Audit page renders the full replayable timeline, Replay spins a new
session on a fresh Daytona sandbox, and Export downloads the review markdown.
After this phase the entire cockpit loop — start, watch, gate, halt, replay —
is demoable end to end.

## Roster

| Subagent | Count | Named role | Deliverables | Parallel? |
|---|---|---|---|---|
| `test-engineer` | 1 | control-flow E2E | Failing specs: halt cycle, cap stop, audit render, replay freshness, export download | yes |
| `safety-engineer` | 1 | Halt + Cap | Halt 2-state button + `/api/agent/halt`; Cap chip + hard stop | yes (status-row files) |
| `integration-engineer` | 1 | Replay | `/api/agent/replay`, fresh-sandbox verification via `sandbox.created`, session bookkeeping | yes (server side) |
| `ui-engineer` | 1 | Audit + Export pages | `/paper/:slug/audit` timeline, `/paper/:slug/export` download | yes (new routes) |
| **Orchestrator** | 1 | freshness proof & merge gate | verifies replay sandbox differs from original; merges | — |

## Entry criteria

- [x] Phase 4 exit green; gates pause/resume reliably; audit rows persist per event (172/172 unit + TC-1/2/3 E2E at Phase 4 close).

## Sub-phase 5.1 — Halt 2-state + Cap (owner: safety-engineer)

**Objective:** one button, two states, no ambiguity (P6 simplification).

**Instructions:**
1. Halt cycles **Pause → Stop** only. Pause suspends the stream (session
   cancel-pause); Stop terminates the turn and locks the run (status `done`
   with halted flag, or `error` if the turn errors). No third state.
2. `POST /api/agent/halt` — body `{paperId, action: pause|stop}`; updates
   paper status; audit gains a halt row.
3. **Cap** — configurable budget guard (per-paper USD/token cap in settings);
   status-row chip `Cap: $0.012`; on exceed: **hard stop** + chip turns red +
   audit row. Cost uses the "—" rule for the custom provider (cap on tokens in
   that case).

**Files:** `components/halt-button.tsx`, `components/cap-chip.tsx`,
`app/api/agent/halt/route.ts`, `tests/halt.test.ts`, `tests/cap.test.ts`,
`e2e/halt.spec.ts`.

**Checklist**
- [x] RED: halt cycle test (running → paused → stopped); cap-exceed hard-stop test; chip red state test — fail first (`tests/halt.test.ts` 9, `tests/cap.test.ts` 10)
- [x] GREEN: full cycle works on a live run; audit rows written for both halt actions and cap stop (`halt.pause` / `halt.stop` / `cap.exceeded` rows)
- [x] Token-based cap path tested for the custom provider (cost "—" rule governs)

**Verification**
- [x] `npm run test:e2e -- halt` green (chromium + judge-ipad): Pause→Stop locks the run, the paused gate card does not resurrect, approvals 409; capTokens=1 hard-stops with the chip red
- [x] Demo beat mechanics E2E-proven (cap red → halted → audit rows); the timed 2:45 beat itself is a Phase 7 rehearsal item

## Sub-phase 5.2 — Audit page (owner: ui-engineer)

**Objective:** `/paper/:slug/audit` renders the replayable timeline per mockup.

**Instructions:**
1. Timeline rows: timestamp + icon + message, exactly the mockup vocabulary
   (▶ session started, ✓ …, ⏸ Verify requested, ✓ user allowed,
   ✓ sandbox run: …).
2. Footer: `Total tokens N · Cost — · Duration Mm Ss` (cost "—" rule).
3. Header actions: `[ Replay this audit ]` and `[ Export as markdown ]`.
4. Data source: `audit` table for live runs, `seed_audits` for the seeded
   paper — the page must render both identically (parity guard is Phase 1's
   `npm run parity`; this phase proves it visually).

**Files:** `app/paper/[slug]/audit/page.tsx`, `app/api/audit/[id]/route.ts`,
`tests/audit-page.test.tsx`, `e2e/audit.spec.ts`.

**Checklist**
- [x] RED: timeline render test (row order, icons, footer with cost "—") fails first (`tests/audit-page.test.tsx`, 8)
- [x] GREEN: live and seeded audits both render; row order matches event sequence numbers (source split mirrors the cockpit: live rows iff the paper has a session_id, seed otherwise)
- [x] Export button navigates to `/paper/:slug/export` (asserted in `e2e/audit.spec.ts`)

**Verification**
- [x] `npm run test:e2e -- audit` green on seed and live papers (chromium + judge-ipad)
- [x] Screenshot: seeded audit page — `screenshots/audit-seeded.png`

## Sub-phase 5.3 — Replay (owner: integration-engineer)

**Objective:** one click re-runs the same claim set on a **fresh** sandbox (P6
add; 3 h estimate).

**Instructions:**
1. `POST /api/agent/replay` — creates a NEW TrueForge session for the same
   paper (new `session_id`, status `running`, previous audit preserved).
2. **Freshness proof:** capture the replay session's `sandbox.created` event
   and assert its `sandboxId` differs from the original run's. If TrueForge
   reuses sandboxes per paper, escalate to the Orchestrator — the fallback is
   workspace-wipe before replay (do not ship silent staleness; see
   ../risks.md).
3. Replay must work **offline** against the fixture PDF (P9: the seed never
   references a live arXiv ID).

**Files:** `app/api/agent/replay/route.ts`, `lib/replay.ts`,
`tests/replay.test.ts`, `e2e/replay.spec.ts`.

**Checklist**
- [x] RED: replay test asserting new session + different sandboxId + preserved old audit — fails first (`tests/replay.test.ts`, 9)
- [x] GREEN: replay works offline (the fake adapter and the fixture source; no network)
- [x] Audit page shows both runs: original rows + "▶ replay started" separator + the replay run's own rows (E2E asserts 2× "Verify requested" and both sandbox ids)

**Verification**
- [x] `npm run test:e2e -- replay` green; sandboxId diff asserted against `GET /api/agent/replay?paperId=` (fresh=true, ids differ)
- [x] Risk register: "Replay fresh-sandbox assumption" marked MITIGATED (fake) with the live-path re-verification noted

## Sub-phase 5.4 — Export (owner: ui-engineer)

**Objective:** `/paper/:slug/export` downloads the review markdown.

**Instructions:**
1. Page per mockup: page count line, `[ Download review.md ]`, section list
   (TL;DR · Claims ↔ evidence · Reproduction diff · Open questions for the
   author).
2. Download generates markdown from the run's stored outputs; locked until the
   Publish gate (Phase 4) is allowed in Review mode.

**Files:** `app/paper/[slug]/export/page.tsx`, `lib/export-md.ts`,
`tests/export-md.test.ts`, `e2e/export.spec.ts`.

**Checklist**
- [x] RED: markdown assembly test (4 sections, claims↔evidence table, Δ line) fails first (`tests/export-md.test.ts`, 4)
- [x] GREEN: download works (seed paper, no publish gate → unlocked); the locked state (publish gate pending/denied) is unit-pinned in `exportLocked` — reachable E2E needs a publish-kind gate from a real adapter (same deferral as Phase 4.3)

**Verification**
- [x] `npm run test:e2e -- export` green; downloaded review.md content matches the fixture sections (attachment headers + all four sections)

## Exit criteria / Definition of Done

- [x] Full loop demoable: start → watch → gate → halt → replay → export (each stage E2E-green; the timed live rehearsal is Phase 7)
- [x] Replay freshness proven with sandboxId evidence (fake adapter per-session sandbox; live re-verify noted in risks.md)
- [x] Audit page renders seed and live identically; parity invariant holds (same AuditRow mapping both sources)
- [x] All Phase 5 E2E green on `judge-ipad` project as well (27/27 chromium + 27/27 judge-ipad; unit 212/212)

## Backlog (defer)

- Multi-run diff view (original vs replay side-by-side) — post-hackathon.
