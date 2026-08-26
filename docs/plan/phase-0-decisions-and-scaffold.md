# Phase 0 — Decisions & Repo Scaffold

**Schedule:** Wed, first 2 h of the 8 h block.

## Goal

Every fork is decided, the repo exists with all root files, Qodo is armed, and
`main` has a first commit that a judge could already clone. No product code yet
— this phase builds the factory floor.

## Roster

| Subagent | Count | Named role | Deliverables | Parallel? |
|---|---|---|---|---|
| `test-engineer` | 1 | scaffold-test writer | Failing tests asserting root files exist and scripts parse | yes |
| `repo-scaffolder` | 1 | repo bootstrap | git init, LICENSE, package.json scripts, .env.example, NOTICE | yes (disjoint files) |
| `compliance-scribe` | 1 | Qodo & legal | QODO_REVIEW.md stub, SECURITY.md, TECHNICAL.md stub, README skeleton, Qodo App install steps | yes (disjoint files) |
| **Orchestrator** | 1 | decision record + merge gate | D1/D2 locked in ../product.md; PR review & merge | — |

## Entry criteria

- [ ] `docs/` tree exists and has passed its 3× verification (docs/plan/VERIFICATION.md).

## Sub-phase 0.1 — Lock the two open decisions (owner: orchestrator)

**Objective:** resolve D1/D2 from [../product.md](../product.md#open-decisions-must-be-resolved-in-phase-0).

**Instructions:**
1. Present D1 (`/paper/:slug` vs `/notebook/:slug`) and D2 (demo creds visible
   vs toggle) to the user if reachable; otherwise apply the defaults
   (`/paper/:slug`, creds visible).
2. Edit `docs/product.md`: change each Default cell to `LOCKED: <choice>`.
3. If a non-default was chosen, grep the entire `docs/` tree for the rejected
   term and rename in one pass (e.g. every `/paper/` route, every "Paper"
   noun). Re-run the docs link check.

**Checklist**
- [ ] D1 recorded as LOCKED in product.md
- [ ] D2 recorded as LOCKED in product.md
- [ ] No dangling references to the rejected option anywhere in `docs/`

**Verification**
- [ ] `grep -rn "notebook" docs/` returns only product.md's decision table (or nothing, if D1 default kept)
- [ ] `grep -n "LOCKED" docs/product.md` shows exactly 2 rows

## Sub-phase 0.2 — Repo init & root files

**Objective:** the day-one root-file set from the plan exists and parses.

**Instructions (repo-scaffolder):**
1. `git init` at `/Users/aditya/Projects/openwrite/`, default branch `main`.
2. Write: `LICENSE` (MIT), `NOTICE`, `LICENSES.thirdparty.txt`,
   `.env.example` (keys: `DAYTONA_API_KEY`, `GMI_API_KEY`, `JWT_SECRET`,
   `DATABASE_URL`, `TF_BASE_URL=http://localhost:18790`), `.gitignore`
   (node, next, .env, /data/pdfs), `package.json` with scripts
   `dev`, `build`, `start`, `test`, `test:e2e`, `parity`, `demo`.
3. `README.md` skeleton with sections: pitch, quickstart
   (`git clone` → `docker compose up`), `## Qodo Code Review Evidence`
   (placeholder link), AI-use disclosure.

**Instructions (compliance-scribe):**
4. `QODO_REVIEW.md` stub at repo root (required from the first commit);
   `SECURITY.md` (sandbox model summary pointing at docs/approval-gates.md);
   `TECHNICAL.md` with the "What is real vs scaffolded today" section header.
5. Document the Qodo App install steps in `QODO_REVIEW.md`
   (portal → Integrations > SaaS > GitHub → one installation per team;
   fallback: comment `/agentic_review` on a PR).

**Instructions (test-engineer — RED first):**
6. Before 2–5 are written, create `tests/scaffold.test.ts` asserting: all root
   files exist; `package.json` parses and contains the 7 scripts; README
   contains the `## Qodo Code Review Evidence` heading. Watch it fail, then
   hand to the scaffolder/scribe.

**Files:** `tests/scaffold.test.ts`, root files listed above.

**Checklist**
- [ ] RED: scaffold tests fail before root files exist
- [ ] GREEN: all root files present; tests pass
- [ ] `.env.example` documents every key the app reads
- [ ] README quickstart has exactly one setup command beyond install: `docker compose up`
- [ ] QODO_REVIEW.md present at repo root, linked from README

**Verification**
- [ ] `npm test` passes (scaffold suite)
- [ ] `ls LICENSE NOTICE QODO_REVIEW.md SECURITY.md TECHNICAL.md .env.example` all present
- [ ] `git log --oneline` shows the first commit containing QODO_REVIEW.md
- [ ] Qodo GitHub App installed on the repo (or install steps executed and noted in the PR)

## Sub-phase 0.3 — Test harness bootstrap (owner: test-engineer)

**Objective:** Vitest + Playwright configs exist so every later phase can be RED-first.

**Instructions:**
1. `vitest.config.ts` (jsdom, colocated `*.test.ts(x)`), `playwright.config.ts`
   with a **WebKit project at viewport 1024×768** named `judge-ipad`.
2. One smoke test per runner proving the harness runs.
3. npm scripts wired: `npm test` → vitest, `npm run test:e2e` → playwright.

**Checklist**
- [ ] `vitest.config.ts` + `playwright.config.ts` committed
- [ ] `judge-ipad` WebKit project at 1024×768 exists in Playwright config

**Verification**
- [ ] `npm test` green
- [ ] `npm run test:e2e -- --list` shows the `judge-ipad` project

## Exit criteria / Definition of Done

- [ ] All sub-phase checklists and verifications above are checked with evidence in the merged PRs
- [ ] `main` is green; every change landed through a Qodo-reviewed PR
- [ ] D1/D2 locked and propagated
- [ ] Risk register updated: "QODO_REVIEW.md placement" marked mitigated

## Backlog (defer)

- `recap init-key` CLI implementation (power-user path) — Phase 6 docs only.
