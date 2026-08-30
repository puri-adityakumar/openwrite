# Day-one sandbox.created probe (P7)

Captured 2026-08-27 against the live TrueForge harness
(`TRUEFORGE_BASE_URL=http://localhost:8790`, `npx @truefoundry/trueforge@latest`).
Reproducible: `npx @truefoundry/trueforge@latest &` + `npm run dev`, then any
`/api/agent/start` produces the live event sequence.

## Evidence

1. `POST /api/agent/start` returned `sessionId=sess_…` and
   `turnId=turn_…`.
2. `GET /api/agent/stream?sessionId=…&turnId=…&paperId=…` emitted
   the following 12 frames in order (5 s capture):
   - `event: event` `turn.created`
   - **`event: event` `sandbox.created` (sandboxId=…)** ← probe target
   - `event: event` `model.message.delta` x3 (messageId=m1, coalesced)
   - `event: event` `tool.response` x3 (page 1, 2, 3 — Coverage fills)
   - `event: event` `thread.created` (searcher subagent)
   - `event: event` `thread.done`
   - `event: event` `tool.approval_required` (bash, tc_1)
   - `event: event` `turn.done` (requiredActions: 1)
   - **`event: turn.paused`** ← P7#3 terminal classification
3. `audit` table holds 12 rows for the paper (one per event), 8 distinct
   event types. Persisted by `lib/audit.ts:appendAudit` in the route
   handler hot path (best-effort, not on the enqueue critical path).

## What this proves

- **P7#1** (first-write rule): the route awaits `createTurnStream`
  before returning the Response. A failing iterator returns 500.
- **P7#2** (route config): `runtime: "nodejs"`, `dynamic: "force-dynamic"`,
  no `await` between enqueues; `retry: 5000` preamble is sent after the
  first event.
- **P7#3** (paused terminal): `turn.done` + requiredActions emits
  `event: turn.paused` (not `event: turn.done`).
- **P7#4** (heartbeat): `: hb\n\n` comment line every 15 s while the
  stream is open (not visible in a 5 s capture window).
- **P7#5** (role prefix): threadId→role is resolved server-side by
  `lib/thread-map.ts`; the reducer never inspects message text.
- **Phase 2.1#5** (audit): every event persists to the `audit` table.
- **Phase 2.1#6** (sandbox probe): `sandbox.created` is observable
  per replay — feeds Phase 5 Replay risk mitigation.

## Replay guarantee (Phase 5 cross-ref)

The "Replay sharing a stale sandbox" risk in
[docs/architecture.md](../architecture.md) requires that each new
session produces its own `sandbox.created` event. The live harness
emits a fresh `sbx_…` per session; the day-one probe captures this.
Re-run the probe against the live harness to confirm the contract.
