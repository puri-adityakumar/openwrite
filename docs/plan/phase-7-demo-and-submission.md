# Phase 7 — Rehearsal, Qodo Final Pass, Video, Submission

**Schedule:** Sat evening (2 h rehearsal) + Sun AM (3 h record & submit) = 5 h,
plus the 2 h Sunday buffer held in reserve.
**Day deliverable:** submitted by Sun 17:00 London, 3 h before the 20:00 deadline.

## Goal

The 12-row beat table is rehearsed twice on the judges' iPad model, Qodo gets a
final clean pass, the 3-minute video is recorded, and the WeMakeDevs submission
is filed with all four required artifacts. The 2 h buffer is ONLY for Sunday
demo crashes.

## Roster

| Subagent | Count | Named role | Deliverables | Parallel? |
|---|---|---|---|---|
| `demo-producer` | 1 | rehearsal & recording | rehearsal runs, final 3-min video, submission write-up | — |
| `compliance-scribe` | 1 | Qodo final pass + submission checklist | all PRs Qodo-clean, README evidence section final, submission form contents | yes |
| `rubric-judge` | 1 | final gate | scores the recorded video + running build; blocks submission if a Savile Row clause is unmet | — |
| **Orchestrator** | 1 | submission authority | only agent allowed to submit; runs final verification | — |

## Entry criteria

- [ ] Phase 6 exit green; rubric-judge gaps from Phase 6 resolved or documented.

## Sub-phase 7.1 — iPad rehearsal ×2 (owner: demo-producer, Sat evening)

**Objective:** the 12-row table in [../demo-script.md](../demo-script.md) is
performed twice, on the iPad model the judges will use, without a single
improvised step.

**Instructions:**
1. Rehearse the full 12 beats on the iPad; log actual vs planned time per row
   (target ±5 s/row; total ≤ 3:00).
2. Any miss → fix → restart the rehearsal from beat 1 (no partial credit).
3. Lock the narrator script verbatim after run 2; paste the final timings into
   `docs/cold-judge-log.md` (or a rehearsal log).

**Checklist**
- [ ] 2 complete rehearsals on the target iPad, timings logged
- [ ] Every beat within ±5 s of the table; total ≤ 3:00
- [ ] Narrator script locked

**Verification**
- [ ] Orchestrator watches one full rehearsal and signs off beat-by-beat

## Sub-phase 7.2 — Qodo final pass (owner: compliance-scribe, Sun AM)

**Objective:** code-quality story is airtight (Q Branch is a free second shot).

**Instructions:**
1. Re-run Qodo on the final HEAD; fix or dismiss-with-reason every valid High.
2. README `## Qodo Code Review Evidence` section: final representative PR link
   + 1–2 sentences (screenshots cannot replace the link).
3. Confirm QODO_REVIEW.md at repo root is current and referenced in the video
   0:30 beat.

**Checklist**
- [ ] Zero open valid High-severity Qodo findings on main
- [ ] README evidence section final (link + sentences)
- [ ] All merges since Phase 0 went through Qodo-reviewed PRs (audit the list)

**Verification**
- [ ] Orchestrator audits the merged-PR list against the Qodo rule
- [ ] `grep -n "Qodo Code Review Evidence" README.md` present with a real PR link

## Sub-phase 7.3 — Record + submit (owner: demo-producer; submission by orchestrator, Sun AM)

**Objective:** the four required submission artifacts filed on the WeMakeDevs
site (NO Devpost).

**Instructions:**
1. Record the 3-min video following the locked script; the video must show
   "TrueForge reaching a tool, running code in the sandbox, and stopping for a
   person" (beats 1:00–2:15 cover this).
2. Write the short write-up: what the agent does + how it uses TrueForge
   (sessions, turn stream, approval pause/resume, subagents, Daytona sandbox).
3. Orchestrator files the submission: public repo link, video, write-up, and
   confirms the README carries the Qodo evidence section.
4. Submit by **17:00 London**. The 2 h buffer after is for crash-fixes only;
   if used, re-record the affected beats and re-submit before 20:00.

**Checklist**
- [ ] Video recorded, ≤ 3:00, all 12 beats visible, QODO_REVIEW.md called out at 0:30
- [ ] Write-up complete (what + how-it-uses-TrueForge)
- [ ] Submission filed on the WeMakeDevs site with all 4 artifacts
- [ ] Submission confirmation captured (screenshot/email) in the phase PR

**Verification**
- [ ] Orchestrator watches the final video against the 12-row table row-by-row
- [ ] `rubric-judge` signs off: "stranger could pick up and drive… asks before
  the irreversible step rather than after it" — both clauses demonstrated
- [ ] Submission timestamp ≤ 17:00 London evidenced

## Exit criteria / Definition of Done (project DoD)

- [ ] All Phase 0–6 exit criteria still green at submission HEAD
- [ ] Video + write-up + repo + Qodo evidence = 4/4 artifacts submitted
- [ ] `npm test`, `npm run test:e2e`, `npm run parity` all green on the tagged submission commit
- [ ] Tag `submission-v1` pushed; repo public; license MIT present

## Backlog (post-hackathon evolution paths)

- CopilotKit co-driving (documented decision: TrueForge-native for the hackathon)
- Drag-and-drop PDF; interactive Tour; multi-run diff view; Write-mode expansion (W1–W5)
