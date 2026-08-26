# Recap — Documentation Hub

> **Single source of truth.** This `docs/` tree replaces `HANDOVER.md` (now removed).
> Every build agent, subagent, and the orchestrator MUST treat these files as the
> only authoritative specification. If code and docs disagree, docs win — or the
> docs are updated in the same PR.

**Product:** Recap (repo name `openwrite`) — a research-paper autopsy you can drive.
**Track:** Savile Row (Best UI), Agent Harness Hackathon (WeMakeDevs × TrueFoundry).
**Deadline:** Sun Aug 30, 2026, 8:00 PM London (internal cutoff 5:00 PM).

## Map

| File | What it owns |
|---|---|
| [product.md](product.md) | Identity, naming, product definition, rubric score, vocabulary, open decisions |
| [architecture.md](architecture.md) | Stack, system diagram, routes, DB schema, SSE flow |
| [ui-mockups.md](ui-mockups.md) | Text mockups for all six screens |
| [approval-gates.md](approval-gates.md) | Verify / Publish / Save spec, G1 card, paste-ready test cases |
| [demo-script.md](demo-script.md) | 12-row beat-by-beat 3-min demo + 60-second stranger test |
| [risks.md](risks.md) | Live risk register and mitigations |
| [research/pain-points.md](research/pain-points.md) | Verified reader/writer pain points (R1–R5, W1–W5) |
| [research/market-gap.md](research/market-gap.md) | Tool complaint mining, unoccupied feature whitespace |
| [research/data-feasibility.md](research/data-feasibility.md) | arXiv / OpenAlex / S2 live-tested data pipeline |
| [research/iteration-log.md](research/iteration-log.md) | The 10-pass MoE iteration log (P1–P10) that produced this plan |
| [reference/hackathon.md](reference/hackathon.md) | Rules, tracks, Qodo mandates, official cookbook |
| [reference/trueforge-api.md](reference/trueforge-api.md) | Verified TrueForge SDK/SSE/sandbox reference + build-vs-buy rule |
| [plan/README.md](plan/README.md) | **The software-factory operating manual** — orchestrator, subagent types, TDD protocol |
| [plan/phase-0 … phase-7](plan/README.md#phase-index) | Phase-wise execution plans, each a self-contained goal |
| [plan/VERIFICATION.md](plan/VERIFICATION.md) | Record of the 3 documentation verification passes |

## Factory quickstart (for the main/orchestrator agent)

1. Read [plan/README.md](plan/README.md) — it defines the agent roster, the TDD
   loop, the PR/Qodo gate, and how phases are entered and exited.
2. Open the current phase file. Trigger exactly the subagents listed in its
   roster, with the roles as written.
3. A phase is DONE only when every item in its checklist AND verification list
   is checked with evidence (command output, test run, or screenshot).
4. Never start phase N+1 while phase N has an unchecked verification item.

## Standing constraints (apply to all phases)

- **No coding outside a phase file's scope.** Scope creep goes to the backlog
  section of the current phase, not into the codebase.
- **Everything through PRs.** Direct pushes to `main` do not count (Qodo rule).
  Fix every valid High-severity Qodo finding or dismiss it in-thread with a reason.
- **100% local.** Judges clone and run. No hosting. `docker compose up` must be
  the only setup command beyond `npm install`.
- **First paint is a populated demo run**, not an empty state. Guard this
  invariant in every phase that touches data or seeds.
