# Risk Register (live)

Each risk names its owning phase. The orchestrator re-checks this table at every
phase exit.

| Risk | Mitigation | Owning phase |
|---|---|---|
| QODO_REVIEW.md placement and demo callout | **MITIGATED (Phase 0.2):** QODO_REVIEW.md present at repo root, linked from README's `## Qodo Code Review Evidence` heading, and contains the Qodo App install steps. Demo beat (0:30) still pending — Phase 7. | 0, 7 |
| Qodo GitHub App not yet installed on the repo | **MITIGATED (Phase 0 close):** App `qodo-code-review` (owner `qodo-ai`, ID 484649) installed on `puri-adityakumar/openwrite` 2026-08-27. First review on PR #1 triggered via `/agentic_review` comment, bug finding fixed, PR squash-merged as `e7f39e0`. | 0 |
| Seeded `seed_audits` drifts from the live path | **MITIGATED (Phase 1.3):** `npm run parity` enforces shape parity at the file level (`tests/seed-render.test.ts`, 5 unit tests) AND live against the DB (`scripts/parity.ts`, exits non-zero on drift). The cockpit renders the same JSON the live audit stream will produce in Phase 2. | 1, 6 |
| iPad-stage demo fragility | Saturday rehearsal + second-device check (Safari 1024×768, < 2 s first-paint render). | 6, 7 |
| Approval TTL expiry | Countdown visible. Deny-on-expiry handler. "Approval expired — restart verification." | 4 |
| Replay fresh-sandbox assumption | **PARTIALLY MITIGATED (Phase 2):** day-one `sandbox.created` probe captured in `docs/phase-2/sandbox-probe.md` against the fake TrueForge adapter. Live-path re-verification deferred to Phase 5 (when the live SDK is installed and a real Daytona sandbox is reachable). | 2, 5 |
| `total_cost_in_usd === 0` for the custom provider | **MITIGATED (Phase 2):** `formatCost` in `lib/event-reducer.ts` returns `"—"` when `totalCostInUsd === 0`; UI Cap chip and metrics fall back to `total_tokens`. Covered by `tests/event-reducer.test.ts > cost display rule`. | 2, 5 |
| Live TrueForge server unavailable in dev (no source checkout) | **MITIGATED (Phase 2):** `lib/trueforge.ts` ships a fake adapter (`TRUEFORGE_MODE=fake`, default) that emits a deterministic event sequence. The live adapter (`TRUEFORGE_MODE=live`) lazy-imports `@truefoundry/trueforge-sdk`; the install is a one-line flip deferred to the day we wire a real TrueForge server. | 2, 5 |
| Daytona key missing at judge time | In-app `.env` banner with copyable curl (lands Phase 3). Sandbox preview mode runs the full flow without Daytona (Phase 3). | 1, 3 |
| First-paint seed references a real arXiv ID (Replay fails offline) | **MITIGATED (Phase 1.1):** seed.sql writes `source_pdf = 'fixtures/papers/attention.pdf'` (a real 621-byte valid PDF) instead of a live arXiv ID. Cockpit renders from `seed_audits` so Replay works without network. | 1, 6 |
| Clean-clone setup time > 60 s on a judge laptop | **MEASURED (Phase 1.3):** 11 s end-to-end from `git clone` to a 200 login on a clean `/tmp/clean-clone-test` (npm install 3 s, compose up 1 s, next build 6 s, next start 1 s). Plan budget was 60 s; measured at ~18% of budget. | 1, 6 |
| `.env` banner poll flicker | Poll every 15 s + immediate poll on window focus (not 5 s). | 3 |

Add new risks here as they are discovered; never track a risk only in chat.
