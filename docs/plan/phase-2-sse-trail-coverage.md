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
- [ ] RED: `tests/event-reducer.test.ts` covers: delta coalescing by messageId; `turn.done`+requiredActions → paused; `turn.done` plain → done; cost `0` renders as "—" with token fallback
- [ ] RED: `tests/sse-route.test.ts` asserts route config (nodejs runtime, force-dynamic) and first-write ordering
- [ ] GREEN: `/paper/new` Start → live run streams into the cockpit
- [ ] `sandbox.created` probe evidence captured in the PR
- [ ] Paper status transitions queued → running → (paused|done|error) tested

**Verification**
- [ ] `npm test -- event-reducer sse-route` green
- [ ] `npm run test:e2e -- live-run` green
- [ ] Orchestrator eyeballs one raw SSE stream (`curl -N`) and confirms heartbeat lines every 15 s

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
- [ ] RED: `tests/thread-map.test.ts` (create → resolve → unknown fallback) fails first
- [ ] GREEN: events carry correct role prefixes in a live run with 2+ subagents

**Verification**
- [ ] Live-run evidence: Pulse lines show at least two distinct role prefixes

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
- [ ] RED: component tests (pill transitions, grid legend, verb-first copy, cost "—") fail first
- [ ] GREEN: live run drives Trail through all 6 pills; Coverage fills
- [ ] Seeded paper still renders identically (no regression to first paint)

**Verification**
- [ ] `npm run test:e2e -- cockpit-live` green (live) and `stranger` still green (seed)
- [ ] Screenshot evidence: mid-run cockpit with ◉ on Verify and partial Coverage

## Exit criteria / Definition of Done

- [ ] All five P7 constraints have at least one named test each (orchestrator audit)
- [ ] Live run: Trail completes, Coverage paints, audit rows persist per event
- [ ] Named risk "turn.done mistaken for completion" has a regression test
- [ ] `sandbox.created` probe result recorded in ../risks.md (fresh-sandbox row)

## Backlog (defer)

- Approval resume plumbing exists only as far as `paused` detection; gate UI is Phase 4.
