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

- [ ] Phase 4 exit green; gates pause/resume reliably; audit rows persist per event.

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
- [ ] RED: halt cycle test (running → paused → stopped); cap-exceed hard-stop test; chip red state test — fail first
- [ ] GREEN: full cycle works on a live run; audit rows written for both halt actions and cap stop
- [ ] Token-based cap path tested for the custom provider (cost "—")

**Verification**
- [ ] `npm run test:e2e -- halt` green
- [ ] Demo beat 2:45 executable: cap red → halt → audit unchanged

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
- [ ] RED: timeline render test (row order, icons, footer with cost "—") fails first
- [ ] GREEN: live and seeded audits both render; row order matches event sequence numbers
- [ ] Export button navigates to `/paper/:slug/export`

**Verification**
- [ ] `npm run test:e2e -- audit` green on seed and live papers
- [ ] Screenshot: seeded audit page matching the mockup row-for-row

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
- [ ] RED: replay test asserting new session + different sandboxId + preserved old audit — fails first
- [ ] GREEN: replay works on the seeded paper with network disabled (offline proof)
- [ ] Audit page shows both runs (original + replay) clearly labeled

**Verification**
- [ ] `npm run test:e2e -- replay` green; sandboxId diff evidence in PR
- [ ] Risk register: "Replay fresh-sandbox assumption" marked verified or escalated

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
- [ ] RED: markdown assembly test (4 sections, claims↔evidence table, Δ line) fails first
- [ ] GREEN: download works post-Publish; locked state clear pre-Publish

**Verification**
- [ ] `npm run test:e2e -- export` green; downloaded file content matches the test fixture sections

## Exit criteria / Definition of Done

- [ ] Full loop demoable: start → watch → gate → halt → replay → export
- [ ] Replay freshness proven with sandboxId evidence (or fallback shipped + documented)
- [ ] Audit page renders seed and live identically; parity invariant holds
- [ ] All Phase 5 E2E green on `judge-ipad` project as well

## Backlog (defer)

- Multi-run diff view (original vs replay side-by-side) — post-hackathon.
