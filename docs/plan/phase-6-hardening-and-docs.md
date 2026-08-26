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

- [ ] Phases 0–5 exit green; the full cockpit loop is demoable.

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
- [ ] 2 stranger sessions completed and logged with timestamps
- [ ] Every P0 fixed with a preceding failing regression test
- [ ] 60-s test passes cold after fixes (both strangers, unaided)
- [ ] Safari 1024×768 first-paint < 2 s evidenced (trace + screenshot)

**Verification**
- [ ] Orchestrator re-runs the stranger E2E cold from a fresh clone in a clean directory
- [ ] `docs/cold-judge-log.md` shows zero unresolved P0s

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
- [ ] README quickstart verified by replaying it in a clean clone
- [ ] Qodo evidence section links a real merged PR (not a screenshot)
- [ ] TECHNICAL.md real-vs-scaffolded table reviewed by the Orchestrator for honesty

**Verification**
- [ ] Link check passes across README + docs tree
- [ ] Qodo rules re-read and each requirement ticked against the repo state

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
- [ ] Fixture pack complete; live fetch disabled → seed + replay still green
- [ ] Tour modal opens from ⓘ and shows 7 screenshots
- [ ] CLI documented as power-user path only

**Verification**
- [ ] `npm run test:e2e` green with network disabled to external APIs
- [ ] Screenshot: Tour modal open over the dashboard

## Sub-phase 6.4 — Parity & adversarial score (owners: infra-engineer + rubric-judge)

**Objective:** seed-vs-live parity is enforced in CI, and the build gets an adversarial score against the Savile Row wording before demo day.

**Instructions:**
1. `npm run parity` runs in CI on every PR; seed-vs-live drift fails the build.
2. `rubric-judge` scores the running build against the Savile Row verbatim
   wording ("…shows what the agent is doing, what it is waiting on, and what
   it did, and asks before the irreversible step rather than after it") and
   files each gap as a blocking issue for Phase 7.

**Checklist**
- [ ] Parity check enforced in CI
- [ ] Rubric-judge report filed; every gap triaged (fix in Phase 7 or document)

**Verification**
- [ ] CI run evidence: parity step green
- [ ] Rubric report attached to the phase PR

## Exit criteria / Definition of Done

- [ ] Both strangers pass the 60-s test cold; zero unresolved P0s
- [ ] README/SECURITY/TECHNICAL complete; Qodo evidence section real
- [ ] Fixtures + Tour + CLI docs done; offline E2E green
- [ ] Parity enforced in CI; rubric-judge report filed
- [ ] Risk register fully re-checked; "seed drift" and "iPad fragility" updated

## Backlog (defer)

- P2 polish items from the cold-judge log (list them in the phase PR).
