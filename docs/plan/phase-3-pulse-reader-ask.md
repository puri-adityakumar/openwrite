# Phase 3 — Pulse, Reader, Ask + @cite, Tabs

**Schedule:** Thu PM, 4 h.
**Day deliverable:** right column tabs work end to end.

## Goal

The cockpit's right column comes alive: Summary / Claims / Authors / Audit tabs
render real run data, Pulse streams its 5-line role-prefixed inspector, the
Reader drawer opens side-by-side with paraphrase + confidence, Ask answers
with `@cite` scoping, and the global `.env` banner keeps missing keys visible
without flicker.

## Roster

| Subagent | Count | Named role | Deliverables | Parallel? |
|---|---|---|---|---|
| `test-engineer` | 1 | surface contract tests | Failing component + E2E tests per surface | yes |
| `ui-engineer` | 2 | (a) Pulse + tabs; (b) Reader + Ask | (a) `pulse.tsx`, tab panel, Summary/Authors tabs; (b) Reader drawer, Claims tab, Ask composer | yes — disjoint components, shared store contract frozen first |
| `infra-engineer` | 1 | env banner | `.env` banner with copyable curl, 15 s + on-focus polling | yes |
| **Orchestrator** | 1 | store-contract freeze & merge gate | freeze the shared store interface before the two ui-engineers start; merges | — |

## Entry criteria

- [ ] Phase 2 exit green; live run populates the reducer store; role map works.

## Sub-phase 3.1 — Pulse + tab shell (owner: ui-engineer (a))

**Objective:** the SSE inspector and the 4-tab right column per mockup.

**Instructions:**
1. **Pulse** — exactly 5 lines, monospace, `HH:MM:SS [role] message` format,
   roles from the Phase 2 thread map, 15 s heartbeat line, toggle relocated to
   the status strip (P3 decision).
2. **Tabs** — Summary (default) · Claims · Authors · Audit. Summary renders the
   agent's structured summary; Authors renders OpenAlex profiles (h-index,
   works, citations, notable works per data-feasibility pipeline).
3. Audit tab links out to `/paper/:slug/audit` (page built in Phase 5; link
   may be disabled with tooltip until then).

**Files:** `components/pulse.tsx`, `components/tabs.tsx`,
`components/tabs/summary.tsx`, `components/tabs/authors.tsx`,
`tests/pulse.test.tsx`, `tests/tabs.test.tsx`, `e2e/tabs.spec.ts`.

**Checklist**
- [ ] RED: pulse test asserts 5-line cap, role prefix format, heartbeat; tabs test asserts default tab + switch
- [ ] GREEN: live run streams role-prefixed Pulse lines; Summary/Authors render from run data
- [ ] Seeded paper renders identical Pulse (5 lines) from `seed_audits`

**Verification**
- [ ] `npm run test:e2e -- tabs` green; seed + live both render
- [ ] Screenshot evidence: Pulse with ≥ 2 role prefixes

## Sub-phase 3.2 — Reader + Claims + Ask (owner: ui-engineer (b))

**Objective:** claim → evidence loop closes inside the cockpit.

**Instructions:**
1. **Claims tab** — Claims↔Evidence table: claim, evidence quote, confidence
   chip. Row click opens the Reader at the anchor.
2. **Reader** — responsive drawer: 40/60 split on ≥1440 px; replaces the right
   column below 1440 px (P3 decision). Shows PDF page + paraphrase +
   confidence chip.
3. **Ask** — bottom composer ("Ask anything in this paper…") with `@cite`
   token autocomplete scoping the question to a claim/section; answers stream
   into the tab panel with citations back into the Reader.

**Files:** `components/tabs/claims.tsx`, `components/reader.tsx`,
`components/ask.tsx`, `tests/claims.test.tsx`, `tests/reader.test.tsx`,
`tests/ask.test.ts`, `e2e/reader-ask.spec.ts`.

**Checklist**
- [ ] RED: claims-row-click → reader-open test; drawer breakpoint test (1439 vs 1440); `@cite` token parse test
- [ ] GREEN: full loop works on live run and seed
- [ ] Confidence chips render on both Claims rows and Reader header

**Verification**
- [ ] `npm run test:e2e -- reader-ask` green on desktop and `judge-ipad` projects
- [ ] Manual evidence: one Ask answer containing a working `@cite` jump

## Sub-phase 3.3 — `.env` banner (owner: infra-engineer)

**Objective:** missing Daytona/GMI keys never block the demo; the banner
replaces the killed pre-demo CLI step.

**Instructions:**
1. Global banner when a required key is absent: one line + **copyable curl**
   command that writes the key into `.env`.
2. Poll every **15 s** + immediately on window focus (P9 fix — never 5 s).
3. When Daytona is missing, the cockpit runs in **Sandbox preview** mode:
   same flow, dry-run badge on the Verify gate card.

**Files:** `components/env-banner.tsx`, `app/api/env-status/route.ts` (or
equivalent server check), `tests/env-banner.test.tsx`, `e2e/banner.spec.ts`.

**Checklist**
- [ ] RED: banner visibility test (key absent vs present) + poll-interval test fail first
- [ ] GREEN: banner shows copyable curl, disappears within one poll after key appears
- [ ] Sandbox-preview badge appears on the Verify card when Daytona key absent

**Verification**
- [ ] `npm test -- env-banner` green; E2E with key removed shows banner; restore key → banner clears
- [ ] No perceptible reflow/flicker on poll (screen-recording evidence)

## Exit criteria / Definition of Done

- [ ] All four tabs render live data; Reader loop closes; Ask cites
- [ ] Pulse honors 5-line + role + heartbeat contract on seed and live
- [ ] Banner behavior matches the 15 s + focus rule; Sandbox preview default without Daytona key
- [ ] First-paint invariant re-verified (stranger E2E still green)
- [ ] Risks updated: "Daytona key missing" and "banner flicker" marked mitigated

## Backlog (defer)

- Tour modal content (7 screenshots) → Phase 6 (assets exist only after UI settles).
