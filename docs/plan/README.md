# The Software Factory — Operating Manual

This directory is the executable plan. The build runs as **one software
factory**: a single main agent (the **Orchestrator**) triggers specialist
**subagents** per phase, verifies everything they produce, and is the only
agent allowed to merge. Each phase file is a self-contained goal: scope,
subagent roster, TDD protocol, sub-phases with checklists, and a verification
list that the Orchestrator must clear with evidence before the next phase opens.

## Phase index

| Phase | Name | Schedule slot | Budget |
|---|---|---|---|
| [0](phase-0-decisions-and-scaffold.md) | Decisions & repo scaffold | Wed (part of 8 h) | 2 h |
| [1](phase-1-infra-auth-firstpaint.md) | Docker infra, schema, auth, first paint | Wed (rest of 8 h) | 6 h |
| [2](phase-2-sse-trail-coverage.md) | SSE plumbing, Trail, Coverage | Thu AM | 5 h |
| [3](phase-3-pulse-reader-ask.md) | Pulse, Reader, Ask + @cite, tabs | Thu PM | 4 h |
| [4](phase-4-approval-gates.md) | Verify / Publish / Save + G1 + expiry | Fri AM | 5 h |
| [5](phase-5-halt-audit-replay.md) | Halt 2-state, Audit page, Replay, Export | Fri PM | 4 h |
| [6](phase-6-hardening-and-docs.md) | Cold-judge test, fixes, docs, fixtures, parity | Sat AM + PM | 8 h |
| [7](phase-7-demo-and-submission.md) | Rehearsal, Qodo final pass, video, submit | Sat eve + Sun | 5 h |
| — | Buffer (Sunday fixes only) | Sun | 2 h |

Build blocks total **39 h + 2 h buffer = 41 h**, ending Sun 17:00 London, 3 h
before the 20:00 deadline. (This table is authoritative; it resolves the
"40 h + 1 h" header note from the old handover in favor of the day-by-day rows.)

## The agents

### Orchestrator (main agent) — exactly 1, always active

The Orchestrator writes production code **only** when a subphase is explicitly
marked `owner: orchestrator`. Its standing duties:

1. **Dispatch** — trigger exactly the subagents in the current phase's roster,
   with the roles and deliverables as written. No more, no fewer, unless the
   phase file is edited first.
2. **Verify** — run every item in each sub-phase's Verification list; keep
   evidence (test output, command output, screenshot ref) in the PR description.
3. **Gate** — open one PR per sub-phase; merge only when (a) the checklist is
   complete, (b) the verification list passes, (c) Qodo review has no unfixed
   valid High findings. Direct pushes to `main` do not count.
4. **Audit** — at phase exit, re-run the phase's full verification list
   end-to-end, update [../risks.md](../risks.md), and mark the phase complete
   in the table above.
5. **Protect invariants** — first paint is always a populated demo run; six
   screens / nine API routes only; docs updated in the same PR as behavior
   changes.

### Subagent types (cast per phase)

| Type | Craft | Spawned in phases |
|---|---|---|
| `repo-scaffolder` | git init, licenses, root files, npm scripts, CI hygiene | 0 |
| `compliance-scribe` | Qodo setup, QODO_REVIEW.md, SECURITY.md, disclosure of AI use | 0, 6, 7 |
| `infra-engineer` | docker-compose override, db-init, schema/seed SQL, parity script | 1, 6 |
| `auth-engineer` | JWT + bcrypt, signup/login routes, session guard | 1 |
| `shell-engineer` | Next.js app shell, landing, dashboard, layout primitives | 1 |
| `integration-engineer` | TrueForge SDK, SSE route handlers, event reducers, sandbox probes | 2, 5 |
| `ui-engineer` | Cockpit surfaces: Trail, Coverage, Pulse, Reader, Ask, tabs | 2, 3 |
| `safety-engineer` | Gate cards, G1 spec rendering, countdown, expiry, Halt | 4, 5 |
| `test-engineer` | Writes the failing tests FIRST for each sub-phase (see TDD protocol) | 0–7 (every phase) |
| `docs-engineer` | README, TECHNICAL.md, approval-gates test assets, fixtures, seed | 6 |
| `qa-facilitator` | Cold-judge test harness: scripts, observation sheet, fix triage | 6 |
| `demo-producer` | iPad rehearsal, beat table timing, screen recording, write-up | 7 |
| `rubric-judge` | Adversarial reviewer: scores the build against the Savile Row wording and the 8.17 target; cannot merge, only block | 6, 7 |

**Counting rule:** a phase file's roster states `type × count` and each
instance's named role (e.g. `ui-engineer ×2` with roles "Trail+Coverage" and
"Pulse"). The Orchestrator may run instances in parallel only when their
deliverables touch disjoint files (stated per roster).

## TDD protocol (binding for every sub-phase)

Test stack: **Vitest** (unit + integration, jsdom) colocated as `*.test.ts(x)`;
**Playwright** for E2E in `e2e/*.spec.ts` (includes a WebKit project at
1024×768 to stand in for judge iPads). Scripts: `npm test`,
`npm run test:e2e`, `npm run parity`, `npm run demo`.

Every sub-phase executes the same loop, in this order:

1. **RED** — `test-engineer` writes the failing test(s) named in the sub-phase's
   Checklist *before* any implementation exists. The Orchestrator confirms the
   tests fail for the right reason and attaches the output to the PR.
2. **GREEN** — the owning specialist implements the minimum to pass. No
   unrelated refactors.
3. **REFACTOR** — owning specialist cleans up; tests stay green.
4. **VERIFY** — the Orchestrator runs the sub-phase Verification list. Each item
   must pass with attached evidence.
5. **REVIEW** — PR opened; Qodo review; valid Highs fixed or dismissed with a
   reason in-thread; Orchestrator merges.

Anti-patterns (reject the PR): implementation written before its failing test;
a verification item checked without evidence; a checklist item marked done that
isn't covered by any test or verification line; scope not present in the
sub-phase's file list.

## How to read a phase file

Each phase file has, in order:

- **Goal** — one paragraph; the phase as a goal in itself.
- **Roster** — subagent `type × count`, named roles, deliverables, parallelism.
- **Entry criteria** — what must be true before starting (previous phase's
  verification list green).
- **Sub-phases** — each with Objective, Instructions (detailed enough for an
  agent with no other context), Files, **Checklist** (work items) and
  **Verification** (the Orchestrator's evidence-backed checks).
- **Exit criteria / Definition of Done** — the phase-level verification list.
- **Backlog** — discovered work explicitly deferred.

A sub-phase is done when its Checklist and Verification are fully checked.
A phase is done when all sub-phases are done AND the phase Exit criteria pass.
Only then does the next phase open.
