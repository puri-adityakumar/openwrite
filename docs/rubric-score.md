# Rubric score — adversarial pass vs the Savile Row wording

Phase 6.4. The track's verbatim bar:

> "…shows what the agent is doing, what it is waiting on, and what it did,
> and asks before the irreversible step rather than after it."

Scored adversarially (assume the judge is hostile; every gap is either
fixed or documented). Evidence citations point at the running build and
the E2E suites.

## Clause 1 — "shows what the agent is doing"

**Strong pass.** Trail (6 state pills), Coverage density grid, Pulse
event log with timestamps, status verb (Running/Paused/Done), token +
sandbox chips. Live-run e2e (`e2e/live-run.spec.ts`) pins the stream; the
seeded first paint is populated.

## Clause 2 — "shows what it is waiting on"

**Strong pass.** Paused runs mount the gate panel; the Verify card renders
the full 11-item G1 spec with a live `M:SS` countdown; the status row
flips verb-first ("Paused on 1 approval gate"); expiry flips the card to
"approval expired — restart verification." with actions disabled.
Evidence: `e2e/gates.spec.ts` TC-1/TC-3, `screenshots/g1-verify-card.png`.

## Clause 3 — "shows what it did"

**Pass.** The audit page renders the full replayable timeline
(`▶ session started`, `⏸ Verify requested`, `✓ user allowed`, sandbox
rows, halt/cap rows) from live or seed data; replay appends a labeled new
run; export downloads the review. Evidence: `e2e/audit.spec.ts`,
`e2e/replay.spec.ts`, `e2e/export.spec.ts`,
`screenshots/audit-seeded.png`.

## Clause 4 — "asks before the irreversible step rather than after it"

**Pass.** All three gates pause BEFORE the action; Allow requires typed
owner + 3s hold; the server refuses decisions on expired gates
atomically; export is locked until Publish is allowed. Evidence:
`tests/approve-route.test.ts`, `e2e/gates.spec.ts`, `e2e/export.spec.ts`.

**Gap noted (adversarial):** the *video* must show the irreversible step
happening AFTER the allow (sandbox run), which in Sandbox-preview mode is
represented by the fake's post-allow events — the TECHNICAL.md table
discloses this. Judge-visible honesty handled there rather than by
changing the flow.

## Gaps filed for Phase 7

| # | Gap | Severity | Disposition |
|---|---|---|---|
| 1 | Sandbox execution is preview-only without a Daytona key (fake events post-allow) | P1 (honesty handled in TECHNICAL.md; demo works) | Phase 7: paste demo keys or present Sandbox-preview beat deliberately (script 2:30 already does) |
| 2 | Live-run Summary/Claims are placeholders until the extract step exists | P2 | Documented in TECHNICAL.md; seed paper shows the real shape |
| 3 | Publish/Save gates not E2E-reachable with the fake adapter | P2 | Cards + locks shipped and unit-tested; documented in TECHNICAL.md |
