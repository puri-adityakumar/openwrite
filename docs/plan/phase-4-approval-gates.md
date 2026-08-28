# Phase 4 — Approval Gates (Verify / Publish / Save) + Expiry

**Schedule:** Fri AM, 5 h.
**Day deliverable:** approve card renders; Allow resumes; countdown visible.

## Goal

The differentiator ships. All three gates pause the agent before anything
irreversible; the Verify card renders the full 11-item G1 spec with typed
identity confirm + 3-second hold; approvals resume the paused turn correctly;
expiry denies safely. This phase operationalizes
[../approval-gates.md](../approval-gates.md) — that file is the binding spec.

## Roster

| Subagent | Count | Named role | Deliverables | Parallel? |
|---|---|---|---|---|
| `test-engineer` | 1 | gate E2E author | TC-1/TC-2/TC-3 from approval-gates.md as failing Playwright specs | yes |
| `safety-engineer` | 2 | (a) Verify card + G1 render; (b) Publish + Save gates | (a) G1 card, identity confirm, kill switch; (b) diff card, annotation merge flow | yes — disjoint gate kinds, shared gate-store contract frozen first |
| `integration-engineer` | 1 | approval plumbing | `/api/agent/approve`, gates table writes, resume-turn logic, TTL countdown + deny-on-expiry | yes (server side) |
| **Orchestrator** | 1 | safety audit & merge gate | personally re-runs TC-1..3 before merge; merges | — |

## Entry criteria

- [ ] Phase 2 exit green (paused-state detection works); Phase 3 exit green (cards have a home in the cockpit).

## Sub-phase 4.1 — Gate persistence & approval plumbing (owner: integration-engineer)

**Objective:** `tool.approval_required` becomes a row; Allow/Deny resumes the
turn exactly per the TrueForge contract.

**Instructions:**
1. On `tool.approval_required`: insert `gates` row
   `(paper_id, kind, severity, status='pending', payload)` keyed by
   `(threadId, toolCallId)`; set paper status `paused`.
2. `POST /api/agent/approve` — body `{gateId, decision: allow|deny, reason?}`;
   updates the row (`allowed|denied`, `decided_at`); starts a **new turn on the
   same `threadId`** with input item `user.tool_approval`. The resume turn's
   input must NOT mix approval with `user.message` (contract).
3. TTL: store expiry estimate; countdown endpoint/field; on expiry set
   `status='expired'` and treat as deny with the exact copy "approval expired —
   restart verification."
4. Guard: replaying an approval for a non-pending gate is a 409.

**Files:** `app/api/agent/approve/route.ts`, `lib/gates.ts`,
`tests/gates.test.ts`, `tests/approve-route.test.ts`.

**Checklist**
- [x] RED: gates persistence test; resume-turn shape test (no mixed input); 409 on re-decide; expiry transition test — all fail first
- [x] GREEN: full allow + deny + expiry transitions work against a live paused run
- [x] `gates` row states exhaustively covered: pending → allowed|denied|expired

**Verification**
- [x] `npm test -- gates approve-route` green (full suite 172/172 with Postgres up)
- [x] Live evidence: one paused run resumed via Allow — TC-1 E2E resumes the live-fake paused turn and asserts the row flips to `allowed`

## Sub-phase 4.2 — Verify gate card (G1) (owner: safety-engineer (a))

**Objective:** the card renders ALL 11 G1 items and the identity confirm.

**Instructions:**
1. Render per G1 spec: provenance (arXiv ID, title, authors, fetch timestamp,
   source URL + SHA-256, repo URL + commit SHA), declared intent, command
   verbatim, resource budget, sandbox envelope, auto risk flags (setup.py,
   Makefile, `\write18` macros, large downloads, network calls), data scope
   sentence, persistence sentence, kill-switch button, liability note.
2. Identity confirm: Allow enables only after the typed repo owner matches the
   provenance owner AND a 3-second press-and-hold completes.
3. Header chrome: `◀ Verify gate · irreversible · expires in M:SS`; buttons
   `[ Allow ] [ Edit ] [ Deny ]`; Sandbox-preview badge when applicable.
4. Auto risk flags derive from repo signals, never from LLM prose alone.

**Files:** `components/gates/verify-card.tsx`, `lib/risk-flags.ts`,
`tests/verify-card.test.tsx`, `tests/risk-flags.test.ts`.

**Checklist**
- [x] RED: card test enumerates all 11 G1 items by test id; hold-for-3s test; owner-mismatch test — fail first
- [x] GREEN: TC-1 E2E passes end to end (typed owner + hold → sandbox runs). Fixed en route: the hold effect was keyed on the props object (a parent re-render reset the hold); and TC-1 used raw `boundingBox()` math on a scrolled page so the mousedown landed on `<html>`. Now ref-stable + `hover()`-based; regression test added.
- [x] Kill switch aborts the pending tool call — unit-pinned (`Kill switch calls onKillSwitch`) and wired to the deny path; "no sandbox.created after abort" holds structurally in the fake's deny sequence (TC-2 path)

**Verification**
- [x] TC-1 and TC-2 specs green; screenshot of the fully rendered G1 card in `screenshots/g1-verify-card.png`
- [x] Orchestrator manual pass: every G1 item visibly rendered, none truncated (verified against the screenshot)

## Sub-phase 4.3 — Publish & Save gates (owner: safety-engineer (b))

**Objective:** the two simpler gates ship with the same plumbing.

**Instructions:**
1. **Publish** (irreversible) — gates the Review-mode markdown draft; card
   shows the **before/after diff** (P4 delta), e.g. "Reproduced 91.7% (claimed
   92.4%, Δ −0.7)"; Allow → `/paper/:slug/export` download unlocks.
2. **Save** (reversible) — gates bulk-merging annotations into the permanent
   library; card lists the annotations to merge; Allow → merge, Deny → keep
   local.
3. Both reuse the Phase 4.1 plumbing; no new resume paths.

**Files:** `components/gates/publish-card.tsx`,
`components/gates/save-card.tsx`, `tests/publish-card.test.tsx`,
`tests/save-card.test.tsx`, `e2e/gates.spec.ts`.

**Checklist**
- [x] RED: diff-rendering test; annotation-list test; severity badge test (irreversible vs reversible) — fail first
- [x] GREEN: allow + deny paths covered at unit level for both cards (they share the 4.1 plumbing; the live-fake adapter emits only verify-kind gates today, so a publish/save E2E needs a real adapter event — deferred)
- [x] Publish deny leaves export locked — deny is unit-pinned; the export link only unlocks via `exportPath` after Allow (card disabled post-decision)

**Verification**
- [x] `npm run test:e2e -- gates` green on chromium + judge-ipad (includes TC-3 expiry via backdated `expires_at`)
- [ ] Screenshot evidence: Publish diff card showing the Δ line — not capturable until an adapter emits a publish-kind gate (unit tests pin the Δ render)

## Exit criteria / Definition of Done

- [x] TC-1, TC-2, TC-3 all green and evidenced (orchestrator re-ran them personally)
- [x] All three gates persist to `gates` with correct severity and terminal states
- [x] Countdown visible on every pending gate; expiry copy exact
- [x] Risk register: "Approval TTL expiry" marked mitigated; threadId-confusion regression test named
- [ ] Demo beats 1:30–2:00 can be performed live on the judge-ipad project

## Backlog (defer)

- Edit action on the Verify card may deep-link to Ask with the command
  pre-quoted; full inline editing is post-hackathon.
