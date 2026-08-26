# Architecture — Recap on TrueForge

Everything on this page was verified against the TrueForge repo/docs on
2026-08-26 (passes P6/P7). See [reference/trueforge-api.md](reference/trueforge-api.md)
for the raw API reference.

## Stack (100% local; judges clone + run)

| Layer | Choice |
|---|---|
| Harness | TrueForge in Docker, `docker-compose.override.yml` (non-clashing ports) |
| Frontend | Next.js 15 App Router, React 19, Tailwind v4, on `:13000` |
| App DB | Postgres second DB in the same container, `schema.sql` + `recap-db-init` service |
| Auth | Local JWT + bcrypt; in-app `.env` banner with copyable curl; `recap init-key` CLI as power-user path |
| Sandbox | Daytona cloud ($200 credit), ephemeral per turn, egress allowlist (arXiv + the paper's repo URL + PyPI) |
| Model | GMI / MiniMax M3 as `custom` OpenAI-compatible provider; Gemini flash-lite as cheap backup |
| Paper data | arXiv Atom API + OpenAlex (free), 3.1 s spacing + backoff, fixtures in `/fixtures/papers/` |
| Code quality | Qodo GitHub App on every PR; `QODO_REVIEW.md` at repo root |
| Demo | 3-min screen recording, beat-by-beat script in [demo-script.md](demo-script.md) |

**Ports:** Next.js `13000`, TrueForge `18790` (upstream default 8790 overridden).

## System diagram

```
                                  ┌──────────────────────────┐
   JUDGE (browser)                │  Daytona cloud sandbox   │
       │                          │  (untrusted paper code)  │
       │ HTTPS                    └────────────▲─────────────┘
       ▼                                         │ tool call
 ┌────────────────────────┐                      │
 │  Next.js cockpit       │  SSE / HTTP          │
 │  localhost:13000       ├─────────────────────►│
 │  (our app, the UI)     │  createTurnStream    │
 │                        │  listTurnEvents      │
 │  - JWT cookie auth     │  respondToApproval   │
 │  - Cockpit surfaces    │  cancel / replay     │
 │  - /api/* handlers     │                      ▼
 └────┬──────────┬────────┘             ┌──────────────────────────┐
      │          │                      │  TrueForge server        │
      │          │ pg                   │  localhost:18790         │
      │          ▼                      │  (docker container)      │
      │   ┌────────────────────┐        │                          │
      │   │ Postgres container │        │  - Agent loop            │
      │   │  (same as TF)      │        │  - Subagents (parallel)  │
      │   │  - trueforge DB    │        │  - SSE event stream      │
      │   │  - recap DB        │        │  - Approval pauses       │
      │   │    users, papers,  │        │  - Generative UI blocks  │
      │   │    audit, gates,   │        │  - Replay / persistence  │
      │   │    annotations,    │        │  - Daytona integration   │
      │   │    seed_audits     │        │                          │
      │   └────────────────────┘        │  MCP servers (catalog):  │
      │                                 │  - Exa (no key)          │
      │   ┌────────────────────┐        │  - GitHub (PAT, optional)│
      │   │ Redis container    │◄───────┤  - (others as added)     │
      │   └────────────────────┘        │                          │
      │                                 └────────────┬─────────────┘
      │                                              │ HTTPS
      │                                              ▼
      │                                 ┌──────────────────────────┐
      │                                 │  LLM providers           │
      │                                 │  - GMI / MiniMax M3      │
      │                                 │    (custom, BYOK)        │
      │                                 │  - Gemini flash-lite     │
      │                                 │    (cheap backup)        │
      │                                 └──────────────────────────┘
      │
      │  every PR ──────────────────────►  Qodo GitHub App reviews
```

## Routes

### User screens (6)

| Route | Purpose |
|---|---|
| `/` | Landing — auth split, populated first paint |
| `/dashboard` | Greeting + auto-open most-recent Paper |
| `/paper/new` | Single input: PDF or arXiv URL + mode dial |
| `/paper/:slug` | **THE COCKPIT** |
| `/paper/:slug/audit` | Replayable event timeline + Replay button |
| `/paper/:slug/export` | Markdown review download |

### API routes (9)

| Route | Contract |
|---|---|
| `POST /api/auth/signup` | email+password → bcrypt → `users` |
| `POST /api/auth/login` | → JWT cookie |
| `POST /api/papers` / `GET /api/papers` | create / list |
| `GET /api/papers/:id` / `DELETE` | read / delete |
| `POST /api/agent/start` | → TrueForge session + first turn |
| `POST /api/agent/approve` | → resume paused turn |
| `POST /api/agent/halt` | → Halt 2-state |
| `POST /api/agent/replay` | → new session, fresh sandbox |
| `POST /api/files/upload` | multipart → `/data/pdfs/<id>.pdf` |
| `GET /api/audit/:id` | events |

Six user screens, nine API routes. **Nothing else.** Any new route is a scope
violation unless added to this table and to the current phase plan in the same PR.

## Database schema (`schema.sql` — single source, applied by `recap-db-init`)

```sql
-- users
id            uuid pk
email         text unique not null
password_hash text not null
name          text
created_at    timestamptz default now()

-- papers
id            uuid pk
user_id       uuid fk users
slug          text unique not null
title         text
source_url    text
source_pdf    text
mode          text           -- learn | deep-read | review
status        text           -- queued | running | paused | done | error
session_id    text
turn_id       text
created_at    timestamptz default now()
updated_at    timestamptz

-- audit
id            bigserial pk
paper_id      uuid fk papers
events        jsonb
created_at    timestamptz default now()

-- annotations
id            uuid pk
paper_id      uuid fk papers
anchor        jsonb
body          text
created_at    timestamptz default now()

-- gates
id            uuid pk
paper_id      uuid fk papers
kind          text           -- verify | publish | save
severity      text           -- reversible | irreversible
status          text           -- pending | allowed | denied | expired
payload       jsonb
decided_at    timestamptz
created_at    timestamptz default now()

-- seed_audits  (first-paint populated demo)
id            bigserial pk
paper_id      uuid fk papers
events        jsonb
```

Five tables. Indexes: `papers(user_id)`; `(paper_id, created_at desc)` on both
`audit` and `gates`; `papers.slug` unique.

**Drift guard:** `npm run parity` asserts `seed.sql`-vs-live schema drift
(see Phase 1 and Phase 6).

## SSE flow (verified end-to-end against the TrueForge API in pass P7)

`createTurnStream(sessionId, {input})` async iterator → Next.js route handler
(`runtime: "nodejs"`, `dynamic: "force-dynamic"`) → browser
`useSyncExternalStore` (single mutable ref; coalesce `model.message.delta` by
`messageId`; 15 s heartbeat).

`tool.approval_required` persists `(threadId, toolCallId, gate)` to the `gates`
table; a countdown is visible. Resume via a **new turn on the same `threadId`**
with `user.tool_approval`. `turn.done` with `requiredActions.length > 0` is
"paused on gate," **not** "complete." Subagent role is inferred from a
`threadId → {role, parent}` map built at `create_sub_agent` time.
`total_cost_in_usd === 0` for the GMI custom provider → display "—", fall back
to `total_tokens`.

### P7 implementation constraints (binding)

1. The first SSE write must `await iterator.next()` so connection failures
   surface immediately.
2. The Next.js route handler needs `runtime: "nodejs"`,
   `dynamic: "force-dynamic"`, and **no `await` between enqueues**.
3. `turn.done` + `requiredActions.length > 0` = paused on gate (UI shows the
   gate card, never the "done" state).
4. Approval TTL is server-side, likely 5–30 min — visible countdown +
   deny-on-expiry ("approval expired — restart verification").
5. Subagent role must come from the `threadId → {role, parentThreadId}` map;
   never from parsing event text.

### Named runtime-bug risks (test for these in Phase 2/4/5)

- Approval expiry + threadId confusion.
- Replay sharing a stale sandbox (verify `sandbox.created` fires per replay).
- `turn.done` mistaken for completion.

## First-paint seed (P9 fixes locked)

- The seeded demo paper uses a **fixture PDF** in `/fixtures/papers/`, not a
  real arXiv ID — Replay must work offline.
- Seed writes events directly to `seed_audits`; `listTurnEvents` is **not** a
  list endpoint, so the seeded Audit tab renders from `seed_audits`, and live
  runs render from `audit`.
- The `.env` banner polls every **15 s** + immediately on window focus
  (the earlier 5 s poll caused perceptible flicker).
