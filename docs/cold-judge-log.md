# Cold-judge log — the 60-second stranger test

Phase 6.1. Two strangers who have never seen this repo get ONLY the repo
URL and the quickstart. We watch silently. Every hesitation, misclick, or
question is a row. **Any fumble that blocks the 60-second test is P0 and
must be fixed today with a failing regression test written first.**

Reference script: [demo-script.md](demo-script.md) ("The 60-second
stranger test"). Second-device check: Safari 1024×768, first paint < 2 s
(automated by the `judge-ipad` Playwright project).

## Observation sheet (copy per stranger)

### Stranger 1 — <name/alias>

- **Date/time:** <fill>
- **Machine/browser:** <fill>
- **Cloned from:** <repo URL>
- **t=0 clone → t=60 verdict:** PASS / FAIL at <step>

| t | Step | What happened | Fumble? | Severity |
|---|---|---|---|---|
| | | | | |

**Notes / verbatim quotes:**

### Stranger 2 — <name/alias>

_(same table)_

## Fumble triage

| # | Finding | Severity (P0/P1/P2) | Fixed in | Regression test |
|---|---|---|---|---|
| | | | | |

## Session status

- [ ] Stranger 1 completed and logged
- [ ] Stranger 2 completed and logged
- [ ] Every P0 fixed with a preceding failing regression test
- [ ] 60-s test passes cold after fixes (both strangers, unaided)
- [ ] Safari 1024×768 first-paint < 2 s evidenced (trace + screenshot)

## Pre-session rehearsal (orchestrator, clean clone)

| Step | Result |
|---|---|
| Fresh `git clone` to a clean directory | ✅ 1.7s (github.com/puri-adityakumar/openwrite @ d798773, `/tmp/cold-judge-clone`) |
| `cp .env.example .env` | ✅ instant |
| `npm install` | ✅ 3.0s (warm npm cache; cold-cache adds download time) |
| `docker compose up -d` (Postgres + Redis + db-init) | ✅ 0.5s (images cached; db-init applied schema.sql + seed.sql) |
| Open http://localhost:13000 → landing | ✅ HTTP 200 ~10s after `npm run dev` (Next cold compile) |
| Sign in `demo@local / demo1234` → dashboard | ✅ HTTP 200 |
| Open seeded run → populated cockpit | ✅ HTTP 200; `/api/papers` returns the seeded run card |
| Total wall-clock (excl. first-ever docker pulls) | **~15s** — well under the 60s budget |

Run 2026-08-28 by the orchestrator against `main` @ `d798773`. The
stranger sessions themselves are pending (need the two humans); the
observation sheet above is ready for them.
