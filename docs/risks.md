# Risk Register (live)

Each risk names its owning phase. The orchestrator re-checks this table at every
phase exit.

| Risk | Mitigation | Owning phase |
|---|---|---|
| QODO_REVIEW.md placement and demo callout | **MITIGATED (Phase 0.2):** QODO_REVIEW.md present at repo root, linked from README's `## Qodo Code Review Evidence` heading, and contains the Qodo App install steps. Demo beat (0:30) still pending — Phase 7. | 0, 7 |
| Seeded `seed_audits` drifts from the live path | `npm run parity` asserts seed-vs-live schema drift. Part of the Saturday cold-judge test. | 1, 6 |
| iPad-stage demo fragility | Saturday rehearsal + second-device check (Safari 1024×768, < 2 s first-paint render). | 6, 7 |
| Approval TTL expiry | Countdown visible. Deny-on-expiry handler. "Approval expired — restart verification." | 4 |
| Replay fresh-sandbox assumption | Verify `sandbox.created` fires on every replay session. Day-one integration test (Phase 2), re-verified in Phase 5. | 2, 5 |
| `total_cost_in_usd === 0` for the custom provider | Display "—" or "(custom provider — cost not tracked)". Fall back to `total_tokens`. | 2, 5 |
| Daytona key missing at judge time | In-app `.env` banner with copyable curl. Sandbox preview mode runs the full flow without Daytona. | 1, 3 |
| First-paint seed references a real arXiv ID (Replay fails offline) | Seed uses a fixture PDF from `/fixtures/papers/`. | 1, 6 |
| `.env` banner poll flicker | Poll every 15 s + immediate poll on window focus (not 5 s). | 3 |

Add new risks here as they are discovered; never track a risk only in chat.
