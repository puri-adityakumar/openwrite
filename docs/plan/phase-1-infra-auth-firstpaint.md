# Phase 1 — Docker Infra, Schema, Auth, First Paint

**Schedule:** Wed, remaining 6 h of the 8 h block.
**Day deliverable (from schedule):** `docker compose up` boots TrueForge; `/`
works; `demo@local` logs in; `/dashboard` shows populated state. Qodo App
installed; first commit (done in Phase 0).

## Goal

A stranger can clone the repo, run `docker compose up`, sign in as
`demo@local`, and land on a `/dashboard` that already shows a populated paper
card — with the seeded cockpit behind it. This is the 60-second stranger test's
first 58 seconds.

## Roster

| Subagent | Count | Named role | Deliverables | Parallel? |
|---|---|---|---|---|
| `test-engineer` | 1 | contract & E2E tests | Failing tests: schema shape, auth flow, seed presence, stranger-test E2E | yes |
| `infra-engineer` | 1 | containers & data | docker-compose.override.yml, schema.sql, seed.sql, recap-db-init, `npm run parity` | yes (infra files) |
| `auth-engineer` | 1 | auth stack | signup/login API, JWT cookie, session guard | yes (app/auth files) |
| `shell-engineer` | 1 | app shell & first paint | Next.js 15 + Tailwind v4 scaffold, `/`, `/dashboard`, seed card rendering | after auth contract test exists |
| **Orchestrator** | 1 | integration & gate | boot verification, seed-vs-live review, merges | — |

## Entry criteria

- [ ] Phase 0 exit criteria green; D1/D2 LOCKED; Qodo armed.

## Sub-phase 1.1 — Docker & databases (owner: infra-engineer)

**Objective:** one `docker compose up` brings up Postgres (with the `recap`
DB created and seeded), Redis, and the `recap-db-init` sidecar. The TrueForge
`server` service is vendored but **opt-in** (gated behind the `trueforge`
Compose profile) so the default `docker compose up` does not require an
external TrueForge source checkout. This honours the standing 100%-local
constraint that `docker compose up` is the only setup command beyond
`npm install`.

**Instructions:**
1. Vendor the official TrueForge `docker-compose.yml`; add
   `docker-compose.override.yml` remapping TrueForge to **18790** and ensuring
   no port clashes. The `server` service carries `profiles: ["trueforge"]` so
   it stays dormant in the default path.
2. `schema.sql` — the exact five tables + indexes from
   [../architecture.md](../architecture.md#database-schema-schemasql--single-source-applied-by-recap-db-init).
3. `seed.sql` — one user (`demo@local` / bcrypt of `demo1234`), one seeded
   paper row (slug `attention-is-all-you-need`, mode `review`, status `done`,
   **fixture PDF path, not a live arXiv ID**), and one `seed_audits` row whose
   events render the full cockpit first paint (Trail all green, full Coverage,
   Summary, 5 Pulse lines).
4. `recap-db-init` compose service: waits for Postgres, creates the `recap` DB
   alongside `trueforge`, applies schema then seed, idempotent.
5. `scripts/parity.ts` + `npm run parity`: asserts the `seed_audits` event
   shape matches the live `audit` event shape (same required keys per event
   type) — the drift guard. With `DATABASE_URL` set, parity also connects to
   the live DB and fails on real drift.

**Files:** `docker-compose.override.yml`, `schema.sql`, `seed.sql`,
`scripts/parity.ts`, `fixtures/papers/attention.pdf` (+ metadata JSON).

**Checklist**
- [ ] RED: `tests/schema.test.ts` (5 tables, indexes, enum value sets) and
  `tests/seed.test.ts` (seed user exists, seeded paper uses fixture path) fail first
- [ ] GREEN: compose stack boots; schema + seed applied idempotently
- [ ] `npm run parity` passes against the seeded DB
- [ ] `docker compose --profile trueforge config` resolves the server build
      context (verifies TF_SOURCE_DIR wiring without forcing a build)

**Verification**
- [ ] `docker compose up -d && docker compose ps` shows all services healthy
- [ ] `psql $DATABASE_URL -c '\dt'` lists exactly the 5 tables
- [ ] `psql … -c "select slug, source_pdf from papers"` shows the fixture path
- [ ] `npm run parity` exit 0

## Sub-phase 1.2 — Auth (owner: auth-engineer)

**Objective:** local JWT + bcrypt auth with the two API routes and a session
guard, matching [../architecture.md](../architecture.md#api-routes-9).

**Instructions:**
1. `POST /api/auth/signup` — validate email/password, bcrypt hash, insert
   `users`, return JWT cookie (httpOnly, sameSite=lax).
2. `POST /api/auth/login` — verify, set cookie. Demo creds `demo@local/demo1234`.
3. `lib/session.ts` guard used by `/dashboard` and all `/paper/*` pages
   (redirect to `/` when unauthenticated).
4. Password rules: ≥ 8 chars; error copy is neutral ("invalid credentials").

**Files:** `app/api/auth/signup/route.ts`, `app/api/auth/login/route.ts`,
`lib/session.ts`, `tests/auth.test.ts`, `e2e/auth.spec.ts`.

**Checklist**
- [ ] RED: `tests/auth.test.ts` (hash/verify unit) + `e2e/auth.spec.ts` (sign up, log in, guard redirect) fail first
- [ ] GREEN: signup/login/guard pass
- [ ] No plaintext password ever logged or returned
- [ ] Cookie flags asserted in test

**Verification**
- [ ] `npm test -- auth` green; `npm run test:e2e -- auth` green
- [ ] Manual: `curl -c - -X POST localhost:13000/api/auth/login -d '{"email":"demo@local","password":"demo1234"}'` returns a Set-Cookie JWT

## Sub-phase 1.3 — App shell, landing, dashboard, first paint (owner: shell-engineer)

**Objective:** Next.js 15 (App Router) + React 19 + Tailwind v4 on :13000;
`/` and `/dashboard` match [../ui-mockups.md](../ui-mockups.md); the seeded
cockpit renders from `seed_audits`.

**Instructions:**
1. Scaffold the app pinned to port **13000**; wire Tailwind v4.
2. `/` — auth-split landing per mockup: Dr. K anchor (40 preprints/week,
   9h → 47 min, 2 sends blocked), "Powered by TrueForge · Daytona · GMI ·
   Qodo", sign-in card, and `demo@local / demo1234` visible under the card
   (decision D2).
3. `/dashboard` — greeting + `[ + New Paper ]` + populated paper cards; the
   seeded card links to `/paper/attention-is-all-you-need`; floating Tour ⓘ
   button (static modal shell acceptable this phase).
4. `/paper/:slug` — **seed render path only**: when the paper's session is
   absent, render Trail / Coverage / Summary / Pulse from `seed_audits`.
   (`listTurnEvents` is not a list endpoint — do not call it for seeds.)
5. `/paper/new` — input + mode dial per mockup; no agent wiring yet (Start may
   501 with a clear message until Phase 2).

**Files:** `app/layout.tsx`, `app/page.tsx`, `app/dashboard/page.tsx`,
`app/paper/new/page.tsx`, `app/paper/[slug]/page.tsx`, `components/*`,
`e2e/stranger.spec.ts`, `tests/seed-render.test.ts`.

**Checklist**
- [ ] RED: `e2e/stranger.spec.ts` implements the 60-second stranger test steps
  t=50→t=60 (landing → login → dashboard card → cockpit first paint) and fails
- [ ] GREEN: full path passes; cockpit renders all four seeded surfaces
- [ ] Landing shows demo creds exactly as `demo@local / demo1234`
- [ ] `/paper/new` mode dial shows all three verbs with Review selectable

**Verification**
- [ ] `npm run test:e2e -- stranger` green on the `judge-ipad` project too
- [ ] Screenshot evidence: cockpit first paint shows Trail (6 green pills), Coverage grid, Summary tab, 5-line Pulse
- [ ] `curl -s localhost:13000` returns the landing HTML containing "Recap"

## Exit criteria / Definition of Done

- [ ] All sub-phase checklists + verifications green with evidence in PRs
- [ ] `docker compose up` from a clean clone reaches a working login in ≤ 60 s (timed once, evidence in PR)
- [ ] `npm run parity` green; seed uses fixture PDF
- [ ] Six-screens/nine-routes invariant intact (no extra routes added)
- [ ] Risks updated: "first-paint seed", "Daytona key missing" (banner lands in Phase 3; note it)

## Backlog (defer)

- `.env` banner with copyable curl → Phase 3 (needs the settings surface).
- `recap init-key` CLI → Phase 6 (docs-only power-user path).
