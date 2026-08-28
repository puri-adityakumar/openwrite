# Phase 6 — Cold-Judge Test, Fixes, Docs, Fixtures, Parity

**Schedule:** Sat AM (3 h cold-judge + fix) + Sat PM (5 h docs/assets) = 8 h.
**Day deliverable:** every fumble surfaced and fixed; all docs and assets ready.

## Goal

Two strangers run the 60-second test cold while we watch; every fumble becomes
a P0 fix. Then the repo's written surface is finished: README quickstart,
SECURITY.md, TECHNICAL.md "real vs scaffolded," approval-gates test assets,
fixtures, Tour modal screenshots, and the seed-vs-live parity guard wired into
CI.

## Roster

| Subagent | Count | Named role | Deliverables | Parallel? |
|---|---|---|---|---|
| `qa-facilitator` | 1 | cold-judge harness | observation sheet, script, fumble triage log, fix PRs | AM |
| `test-engineer` | 1 | regression net | every fumble gets a failing test BEFORE its fix | AM |
| `docs-engineer` | 2 | (a) README/SECURITY/TECHNICAL; (b) fixtures + Tour assets + `recap init-key` docs | written surface + assets | PM, parallel (disjoint files) |
| `infra-engineer` | 1 | parity + seed finalization | `npm run parity` in CI, final `seed.sql`, fixture refresh | PM |
| `rubric-judge` | 1 | adversarial scoring | scores the build vs Savile Row wording; files blocking gaps | PM |
| **Orchestrator** | 1 | triage & merge gate | prioritizes fumbles P0→P2; merges | — |

## Entry criteria

- [x] Phases 0–5 exit green; the full cockpit loop is demoable (PR #11 merged at d798773 with 226/226 unit + 54/54 E2E).

## Sub-phase 6.1 — Cold-judge test (owner: qa-facilitator, Sat AM)

**Objective:** run the [../demo-script.md](../demo-script.md) 60-second
stranger test with **2 strangers** who have never seen the repo.

**Instructions:**
1. Recruit 2 people not involved in the build. Give them ONLY the repo URL.
2. Observe silently; log every hesitation, misclick, and question with a
   timestamp. Use the observation sheet (create `docs/cold-judge-log.md`).
3. Each fumble → P0/P1/P2 triage: P0 = blocks the 60-s test (fix today);
   P1 = confusion but recovered (fix today if ≤ 30 min); P2 = polish (backlog).
4. Every fix follows TDD: `test-engineer` writes the failing regression test
   first.
5. Also run the second-device check: Safari at 1024×768, first paint < 2 s
   (the `judge-ipad` Playwright project automates the render-time assertion).

**Files:** `docs/cold-judge-log.md`, regression tests per fumble.

**Checklist**
- [ ] 2 stranger sessions completed and logged with timestamps — **pending: needs the two humans**; the observation sheet is ready in `docs/cold-judge-log.md`
- [ ] Every P0 fixed with a preceding failing regression test — n/a until the sessions run
- [ ] 60-s test passes cold after fixes (both strangers, unaided) — pending the sessions
- [x] Safari 1024×768 first-paint < 2 s — the `judge-ipad` Playwright project passes 27/27 (warm runs ~15s for the full project, each navigation well under budget)

**Verification**
- [x] Orchestrator re-runs the cold path from a fresh clone in a clean directory — done against main @ d798773 in `/tmp/cold-judge-clone`: clone 1.7s, install 3.0s, compose up 0.5s, landing/login/cockpit all 200 (~15s total; logged in the doc)
- [ ] `docs/cold-judge-log.md` shows zero unresolved P0s — pending the sessions

## Sub-phase 6.2 — Written surface (owner: docs-engineer (a), Sat PM)

**Objective:** a judge reads only the repo and succeeds.

**Instructions:**
1. **README.md** — pitch, architecture summary, quickstart (`git clone` →
   `docker compose up` → demo creds), the `## Qodo Code Review Evidence`
   section with ≥ 1 representative merged-PR link + 1–2 sentences on
   findings/resolutions, AI-use disclosure, link to `docs/`.
2. **SECURITY.md** — the sandbox model: Daytona envelope, egress allowlist,
   data-scope sentence, persistence sentence, kill switch, approval TTL.
3. **TECHNICAL.md** — the "What is real vs scaffolded today" section (P4
   delta): honest table of what runs live vs what is preview/fixture.
4. Cross-links: README ↔ QODO_REVIEW.md ↔ docs/approval-gates.md ↔
   docs/demo-script.md.

**Files:** `README.md`, `SECURITY.md`, `TECHNICAL.md`.

**Checklist**
- [x] README quickstart verified by replaying it in a clean clone (see 6.1 log)
- [x] Qodo evidence section links a real merged PR — now cites #11 (17-finding triage) alongside #1
- [x] TECHNICAL.md real-vs-scaffolded table written from the shipped test inventory; honesty check: every preview row names its trigger, every real row cites tests

**Verification**
- [x] Link check across README + docs tree (all internal links point at existing files: SECURITY.md, TECHNICAL.md, docs/*)
- [x] Qodo rules re-read — all merges since Phase 0 land through Qodo-reviewed PRs (#3–#11); PR #12 continues the loop

## Sub-phase 6.3 — Fixtures, Tour, CLI docs (owner: docs-engineer (b), Sat PM)

**Objective:** offline-capable assets complete.

**Instructions:**
1. `/fixtures/papers/` — final fixture PDF + cached metadata (arXiv/OpenAlex/S2
   responses) so seed + replay work offline.
2. Tour modal — capture the 7 screenshots, wire the static "How it works"
   modal to the floating ⓘ CTA.
3. `recap init-key` CLI — implement the minimal power-user path and document
   it in README **after** the demo path (it is not a pre-demo step — P3 kill).

**Files:** `fixtures/papers/*`, `public/tour/*.png`, `components/tour.tsx`,
`cli/init-key.ts`, README section.

**Checklist**
- [x] Fixture pack complete — `fixtures/papers/{attention.pdf,attention.json}` ship in-repo; seed + replay are offline by design (P9), unit + e2e green without external calls
- [x] Tour modal opens from the floating ⓘ and shows 7 screenshots (captured live into `public/tour/`) — replaces the dead `href="#"` link; `tests/tour.test.tsx`
- [x] CLI documented as power-user path only — `npx tsx cli/init-key.ts KEY=VALUE`, README says explicitly it is not a pre-demo step

**Verification**
- [x] `npm run test:e2e` green (54/54 both projects); the seed/replay paths make no external calls (the fixture pack is in-repo)
- [x] Screenshots captured — the tour slides themselves are the evidence (`public/tour/*.png`); modal-over-dashboard capture left for the Phase 7 rehearsal pass

## Sub-phase 6.4 — Parity & adversarial score (owners: infra-engineer + rubric-judge)

**Objective:** seed-vs-live parity is enforced in CI, and the build gets an adversarial score against the Savile Row wording before demo day.

**Instructions:**
1. `npm run parity` runs in CI on every PR; seed-vs-live drift fails the build.
2. `rubric-judge` scores the running build against the Savile Row verbatim
   wording ("…shows what the agent is doing, what it is waiting on, and what
   it did, and asks before the irreversible step rather than after it") and
   files each gap as a blocking issue for Phase 7.

**Checklist**
- [x] Parity check enforced in CI — `.github/workflows/ci.yml` runs typecheck + unit + `npm run parity` on every PR/push to main (E2E remains a local pre-merge gate: needs the Docker stack)
- [x] Rubric-judge report filed — `docs/rubric-score.md` scores all four clauses of the Savile Row wording with evidence; 3 gaps triaged (1 P1 honesty item handled by TECHNICAL.md, 2 P2 documented)

**Verification**
- [ ] CI run evidence: parity step green — will appear on this PR's first Actions run
- [x] Rubric report attached to the phase PR (this one)

## Exit criteria / Definition of Done

- [ ] Both strangers pass the 60-s test cold; zero unresolved P0s — **pending humans** (sheet ready, clean-clone path verified at ~15s)
- [x] README/SECURITY/TECHNICAL complete; Qodo evidence section real
- [x] Fixtures + Tour + CLI docs done; offline E2E green
- [x] Parity enforced in CI; rubric-judge report filed
- [x] Risk register re-checked this phase: "seed drift" parity guard now in CI; "iPad fragility" — judge-ipad project 27/27 (warm)

## Backlog (defer)

- P2 polish items from the cold-judge log (list them in the phase PR).
