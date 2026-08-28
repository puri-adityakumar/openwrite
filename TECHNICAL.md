# Technical — what is real vs scaffolded today

The honest table (P4 delta). Everything below is verifiable from the repo:
each "real" row cites its tests; each "preview" row names its trigger.

**Repo layout**: Next.js App Router (TypeScript, Tailwind) · Postgres
(schema + idempotent seed + parity guard) · SSE event pipeline (P7
constraints) · a TrueForge adapter boundary with two backends (`fake`,
`live`) · Playwright E2E on desktop + an iPad judge profile.

## Real today

| Surface | What actually runs | Evidence |
|---|---|---|
| Auth | Signup/sign-in, JWT cookie sessions, per-route ownership checks, rate limits | `tests/auth.test.ts` (12) |
| Data layer | `schema.sql` (papers, gates, audit, claims, annotations, seed_audits) + idempotent seed + shape-parity script | `tests/schema.test.ts`, `tests/seed.test.ts`, `npm run parity` |
| Live SSE pipeline | First-write ordering, no-await enqueues, paused-terminal framing, 15s heartbeats, seq dedupe, per-event audit persistence | `tests/sse-route.test.ts`, `tests/event-reducer.test.ts` (16) |
| Approval gates | Verify/Publish/Save cards (Verify renders the full 11-item G1 spec: typed owner + 3s hold, kill switch, auto risk flags), durable `gates` rows, server-side TTL with atomic expiry, resume-first approval on the same `threadId` with a `user.tool_approval` item | `tests/{gates,approve-route,gate-countdown,verify-card,publish-card,save-card,risk-flags}.test.*`, `e2e/gates.spec.ts` (TC-1/2/3) |
| Halt + Cap | Pause→Stop cycle (Pause suspends the live stream; Stop terminates + locks; halted runs refuse streams/approvals), per-paper USD/token cap with hard stop + red chip | `tests/halt.test.ts`, `tests/cap.test.ts`, `e2e/halt.spec.ts` |
| Audit page | Replayable timeline from live `audit` rows or `seed_audits`, rendered identically from one row-mapper; totals footer with the Cost—" rule | `tests/audit-page.test.tsx`, `e2e/audit.spec.ts` |
| Replay | New session per replay; pending gates superseded + denied upstream; fresh-sandbox proof (`sandbox.created` id differs) | `tests/replay.test.ts`, `e2e/replay.spec.ts` |
| Export | Review markdown (4 sections + Δ line), attachment download, locked without an allowed Publish gate | `tests/export-md.test.ts`, `e2e/export.spec.ts` |
| Ask (paper Q&A) | Real GMI Cloud call — Anthropic `/v1/messages` format, normalised usage; live probe returned a grounded answer | PR #10 records the live probe (`totalTokens: 142`) |
| Ops surfaces | Env banner (missing-key guidance, Sandbox-preview badge), in-app rate limiting, Tour modal (7 slides), `recap init-key` CLI | `tests/env-banner.test.tsx`, `tests/tour.test.tsx`, `tests/init-key.test.ts` |

## Preview / fixture today

| Surface | What is previewed | What makes it real |
|---|---|---|
| TrueForge adapter | `TRUEFORGE_MODE=fake` (default): a deterministic in-process double emits the full event vocabulary, including the paused terminal and post-resume sequences. The `live` backend exists behind a lazy SDK import — the package is intentionally not installed. | `npm install @truefoundry/trueforge-sdk` + `TRUEFORGE_MODE=live TRUEFORGE_BASE_URL=…` |
| Daytona sandbox | No `DAYTONA_API_KEY` in dev ⇒ "Sandbox preview" mode: `sandbox.created` events are fake, no real isolation is exercised. The envelope on the Verify card renders "—" when the payload doesn't specify it. | Requires **both**: the TrueForge SDK installed + `TRUEFORGE_MODE=live` (see the adapter row above) **and** `DAYTONA_API_KEY` set. Setting the key alone only changes the env banner — the adapter stays fake. |
| Seed first paint | The demo paper renders from `seed_audits`/`seed_claims` fixture data (offline-capable by design, P9) | Live runs replace it per paper once a session starts |
| Publish/Save gates | Cards + plumbing + locks are shipped and unit-tested, but the fake adapter emits only verify-kind gates, so they are not E2E-reachable yet | A real adapter event with `gateKind: "publish" \| "save"` |
| Live-run Summary/Claims | Live runs render placeholder Summary/Claims until the extract step writes them; the seeded paper shows the real shape | Extract-step wiring (post-hackathon backlog) |
| USD cost cap | The custom provider reports `total_cost_in_usd === 0`, so the token cap is the effective guard and cost displays as "—" (never "$0.00") | A provider that reports real cost |

## Known constraints

- The TrueForge server itself is not in this repo (vendored compose file
  expects a sibling checkout); the demo path runs entirely on the fake
  adapter + local Postgres/Redis.
- The active-stream registry (Pause suspension) is single-process —
  correct for the single-container demo; a multi-instance deployment
  would move it to Redis pub/sub.
- `listJustExpired` matches rows by exact `decided_at` timestamp — fine
  for the single-writer demo path; a queue/claim model is the production
  shape.

## Pointers

- Architecture deep-dive: [docs/architecture.md](docs/architecture.md)
- Approval-gates spec (binding): [docs/approval-gates.md](docs/approval-gates.md)
- Risk register: [docs/risks.md](docs/risks.md)
- Security model: [SECURITY.md](SECURITY.md)
- How to read the plan: [docs/plan/README.md](docs/plan/README.md)
