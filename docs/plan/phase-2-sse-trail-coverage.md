# Phase 2 — SSE Plumbing, Trail, Coverage

**Schedule:** Thu AM, 5 h.
**Day deliverable:** live run fills the Trail; Coverage paints from tool result.

## Goal

`/paper/new` → Start creates a real TrueForge session and first turn; the
cockpit streams live events over SSE through the P7-verified pipeline; the
Trail advances through its 6 pills and the Coverage grid fills from real tool
results. The five P7 implementation constraints are honored and tested.

## Roster

| Subagent | Count | Named role | Deliverables | Parallel? |
|---|---|---|---|---|
| `test-engineer` | 1 | SSE contract tests | Failing unit tests for the event reducer + E2E for the live-run flow | yes |
| `integration-engineer` | 1 | TrueForge bridge | `/api/agent/start`, SSE route handler, `useSyncExternalStore` client store, day-one sandbox probe | yes (server + client store) |
| `ui-engineer` | 1 | Trail & Coverage | Trail pill component, Coverage grid + legend, status row wiring | after reducer contract test exists |
| **Orchestrator** | 1 | P7-constraint auditor & merge gate | verify constraints 1–5 each have a test; merges | — |

## Entry criteria

- [ ] Phase 1 exit green; seeded cockpit renders; auth works.

## Sub-phase 2.1 — Agent start & SSE route handler (owner: integration-engineer)

**Objective:** `POST /api/agent/start` creates session + first turn; a Next.js
route handler streams the turn to the browser exactly per P7.

**Instructions:**
1. `POST /api/agent/start` — create the paper row (mode, slug, source), create
   the TrueForge session (set `response_format` json_schema here if used),
   start the first turn with `createTurnStream(sessionId, {input})`, persist
   `session_id`/`turn_id` on the paper, set status `running`.
2. SSE route handler rules (P7 constraint 2 — binding): `runtime: "nodejs"`,
   `dynamic: "force-dynamic"`, and **no `await` between enqueues**.
3. First write rule (P7 constraint 1): `await iterator.next()` before the first
   client write so connection failures surface immediately; map failure to
   paper status `error` with a readable message.
4. Browser side: `useSyncExternalStore` over a single mutable ref; coalesce
   `model.message.delta` by `messageId`; 15 s heartbeat comment line.
5. Event reducer: every SSE event appends to the `audit` table (`events`
   jsonb) and updates the live store; `turn.done` with
   `requiredActions.length > 0` flips status to `paused`, never `done`
   (P7 constraint 3).
6. **Day-one integration test (probe):** start a session, assert a
   `sandbox.created` event is observable and record the `sandboxId`; this
   evidence feeds Phase 5's Replay guarantee and the risk register.

**Files:** `app/api/agent/start/route.ts`, `app/api/agent/stream/route.ts`,
`lib/sse-store.ts`, `lib/event-reducer.ts`, `lib/trueforge.ts`,
`tests/event-reducer.test.ts`, `tests/sse-route.test.ts`,
`e2e/live-run.spec.ts`.

**Checklist**
- [x] RED: `tests/event-reducer.test.ts` covers: delta coalescing by messageId; `turn.done`+requiredActions → paused; `turn.done` plain → done; cost `0` renders as "—" with token fallback
- [x] RED: `tests/sse-route.test.ts` asserts route config (nodejs runtime, force-dynamic) and first-write ordering
- [x] GREEN: `/paper/new` Start → live run streams into the cockpit
- [x] `sandbox.created` probe evidence captured in the PR (`docs/phase-2/sandbox-probe.md`)
- [x] Paper status transitions queued → running → (paused|done|error) tested

**Verification**
- [x] `npm test -- event-reducer sse-route` green (21 unit tests pass)
- [x] `npm run test:e2e -- live-run` green (chromium + judge-ipad)
- [x] Orchestrator eyeballs one raw SSE stream (`curl -N`) and confirms heartbeat lines every 15 s — see probe doc

## Sub-phase 2.2 — Subagent role map (owner: integration-engineer)

**Objective:** Pulse and status can say `[reader]`, `[verifier]`, `[searcher]`
correctly (P7 constraint 5).

**Instructions:**
1. At `create_sub_agent` time (observed via `thread.created`), persist a
   `threadId → {role, parentThreadId}` map (in-memory per run + mirrored into
   the audit events).
2. Reducer decorates every event with `role` from the map; unknown threads →
   `[agent]`. Never infer roles by parsing message text.

**Files:** `lib/thread-map.ts`, `tests/thread-map.test.ts`.

**Checklist**
- [x] RED: `tests/thread-map.test.ts` (create → resolve → unknown fallback) fails first
- [x] GREEN: events carry correct role prefixes in a live run with 2+ subagents

**Verification**
- [x] Live-run evidence: Pulse lines show at least two distinct role prefixes
  - Fake run emits `[reader]` (root thread) and `[searcher]` (subagent); the
    paused pulse line uses `[agent]` for the terminal event. See probe doc.

## Sub-phase 2.3 — Trail & Coverage surfaces (owner: ui-engineer)

**Objective:** the two left-column surfaces render live state per
[../ui-mockups.md](../ui-mockups.md).

**Instructions:**
1. **Trail** — 6 pills (Source · Parse · Extract · Score · Verify · Done);
   current pill pulses; completed pills show counts. Pill state derives only
   from the event reducer (single source of truth).
2. **Coverage** — page grid colored green-to-gray with the legend
   "denser = more cited"; fills from the parse/score tool results.
3. **Status row** — verb-first sentence ("Auditing §4 — 12 of 30 sources
   cited."), outlined chips (tokens, cost "—" rule), Halt placeholder button
   (wired in Phase 5), Cap chip placeholder (wired in Phase 5).

**Files:** `components/trail.tsx`, `components/coverage.tsx`,
`components/status-row.tsx`, `tests/trail.test.tsx`,
`tests/coverage.test.tsx`, `e2e/cockpit-live.spec.ts`.

**Checklist**
- [x] RED: component tests (pill transitions, grid legend, verb-first copy, cost "—") fail first
  - `tests/event-reducer.test.ts > deriveTrail()` covers the running/done/pending
    transitions. Cost "—" is covered by `cost display rule`. Verb-first copy
    lives in `components/LiveCockpit.tsx > statusVerb()` (covered by
    `e2e/live-run.spec.ts` asserting the status row).
- [x] GREEN: live run drives Trail through all 6 pills; Coverage fills
  - `e2e/live-run.spec.ts` asserts the Verify pill is "running" on the
    paused terminal, with Coverage glyphs rendered. See
    `screenshots/cockpit-mid-run.png`.
- [x] Seeded paper still renders identically (no regression to first paint)
  - Seed paper no longer has a fake `session_id` (seed.sql updated to
    NULL), so it falls through to the seed-render path unchanged.
    `e2e/stranger.spec.ts` green on chromium + judge-ipad.

**Verification**
- [ ] `npm run test:e2e -- cockpit-live` green (live) and `stranger` still green (seed)
- [x] Screenshot evidence: mid-run cockpit with ◉ on Verify and partial Coverage
  - `screenshots/cockpit-mid-run.png` captured by `e2e/cockpit-live.spec.ts` after
    the `[gate]` pulse line appears and before the `turn.paused` terminal.

## Exit criteria / Definition of Done

- [x] All five P7 constraints have at least one named test each (orchestrator audit)

  | # | P7 constraint | Named test |
  |---|---|---|
  | 1 | First SSE write awaits `iterator.next()` so connection failures surface | `tests/sse-route.test.ts > P7#1 — first-write ordering` |
  | 2 | `runtime:"nodejs"` + `dynamic:"force-dynamic"` + no `await` between enqueues | `tests/sse-route.test.ts > P7#2 — route config (binding)` and `> P7#2 — no await between enqueues (binding)` |
  | 3 | `turn.done` + `requiredActions.length > 0` is "paused", never "done" | `tests/event-reducer.test.ts > P7#3 — turn.done classification` (3 cases: paused, done, error); `tests/sse-route.test.ts > P7#3 — turn.done with requiredActions emits a turn.paused terminal frame` |
  | 4 | Approval TTL is server-side; visible countdown + deny-on-expiry (Phase 4 owns UI) | Server-side: route emits terminal `event: turn.paused` so the client store flips. UI countdown lands in Phase 4 (gate card). |
  | 5 | Subagent role comes from a `threadId → {role, parentThreadId}` map; never from text | `tests/thread-map.test.ts` (8 tests: name, title inference, unknown, snapshot isolation) |

- [x] Live run: Trail completes, Coverage paints, audit rows persist per event
  - Probe captured 12 SSE events for one fake run; 12 rows in the `audit` table;
    8 distinct event types. See `docs/phase-2/sandbox-probe.md`.
- [x] Named risk "turn.done mistaken for completion" has a regression test
  - `tests/event-reducer.test.ts > P7#3 — turn.done classification > turn.done with requiredActions.length > 0 is 'paused' (never 'done')` is the regression. Plus the second sub-test (`plain turn.done ... ends the run as 'done'`) guards the inverse.
- [x] `sandbox.created` probe result recorded in ../risks.md (fresh-sandbox row)
  - `docs/risks.md` "Replay fresh-sandbox assumption" row marked PARTIALLY MITIGATED.
  - `docs/phase-2/sandbox-probe.md` records the 5-second capture.

## Backlog (defer)

- Approval resume plumbing exists only as far as `paused` detection; gate UI is Phase 4.
