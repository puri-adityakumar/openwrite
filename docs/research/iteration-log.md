# Iteration Log — the 10-pass loop that produced this plan

Each pass fired or re-fired one or more of a 5-agent MoE panel (hackathon judge,
senior TrueForge engineer, product designer, DevRel/OSS reviewer, security
engineer), plus internal-reasoning passes. Score moved 7.5 → 8.17 weighted.

| Pass | Panelist(s) | What changed / evidence |
|---|---|---|
| P1 | All 5 in parallel | 50+ findings; applied 4 BLOCKERs, 6 HIGHs, judge's top-5 kill-shots. Naming, structure, demo, safety, SSE flow rewritten. Contradictions resolved: judge wanted TrueForge auth UI — engineer confirmed TrueForge ships no end-user auth UI. Judge wanted Exa/GitHub MCP for follow-ups — engineer flagged MCP wiring eats half a day. |
| P2 | Senior PM-engineer | 10 of 13 candidate cuts applied. 4 adds: `npm run demo` preload script, panic-button toast, Coverage-heatmap legend, `docs/demo-script.md`. Net +1.5–2 days runway. Drizzle dropped → `schema.sql` + db-init container. Drag-and-drop PDF deferred. |
| P3 | Product designer | 5 contradictions resolved. Killed "lead with Audit" framing (kept choreography as climax beat). SSE inspector → 5 lines monospace + role prefix, toggle to status strip. Drawer → responsive split (40/60 ≥1440 px). Status sentence verb-first, chips outlined. Killed `recap init-key` pre-demo step → in-app banner with copyable curl. **Key insight:** first-paint populated demo run + "Replay guided tour" CTA wins the stranger test. |
| P4 | Judge | Score 7.5 → locked 6 per-criterion deltas: quantified persona beat, Publish before/after diff, TECHNICAL.md "real vs scaffolded," 5-s sponsor-stack beat at 0:30, Halt 3-state (→ 2-state in P6), 12-row demo rehearsed on iPad. |
| P5 | Internal | Collapsed 11 floating terms → 5 nouns + 3 verbs (see product.md vocabulary). Cross-checked against TrueForge vocabulary — no collisions. |
| P6 | Senior full-stack engineer | 10 features graded with hours/risks/fallbacks. CUT Tour (6 h) → static modal. SIMPLIFY Halt → 2-state. ADD "Replay this audit" (3 h, fresh Daytona sandbox). Total 30 h ship + 2 h buffer for those 10 features. |
| P7 | Senior integration engineer | 12 assumptions (A–L) verified against the TrueForge API. 5 binding implementation constraints + 3 named runtime-bug risks (see architecture.md § SSE flow). First-paint seed writes to `seed_audits`; `listTurnEvents` is not a list endpoint; `total_cost_in_usd === 0` for GMI custom provider → display "—". |
| P8 | Internal | 4-day schedule locked: 40 h ship + 1 h buffer (table in plan/README.md is authoritative). Submit Sun 17:00 London. `npm run demo` demoted to a one-off `seed.sql` insert. |
| P9 | Internal | End-to-end UX walkthrough, second-by-second. Fixed: seed referenced a real arXiv ID (Replay would fail offline) → fixture PDF; `.env` banner 5 s poll flicker → 15 s + on-focus poll. Locked the 60-s stranger test and 12-row demo table. |
| P10 | Fresh judge | Final score **8.17/10**. Last-mile: QODO_REVIEW.md at repo root from first commit, linked from README, called out in demo; `npm run parity` seed-vs-live drift assertion; second-device iPad check (Safari 1024×768, < 2 s first paint). All four track-wording clauses addressed. |
