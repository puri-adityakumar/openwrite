# Security

Recap handles three classes of untrusted input and one class of untrusted
execution. This document summarizes the model. The full threat model and
gate-by-gate behavior live in [docs/approval-gates.md](docs/approval-gates.md);
what is real vs previewed today is tabled in [TECHNICAL.md](TECHNICAL.md).

## Untrusted input

- **Paper PDFs** — uploaded by the user; parsed but not executed.
- **arXiv / OpenAlex responses** — fetched over HTTPS; treated as data, not code.
- **Paper repository URLs** — referenced by the agent when the user runs Review
  mode. Outbound HTTP is allowlisted to the paper's own host and to PyPI.

## Untrusted execution

Paper code is **never** executed in the Next.js process or in TrueForge's
primary container. It runs only inside an ephemeral Daytona sandbox with
egress allowlisted to (a) arXiv, (b) the paper's repo URL, and (c) PyPI. The
sandbox is destroyed at turn end, and each session gets a fresh one — replay
freshness is proven by comparing `sandbox.created` ids (workspace-wipe is the
documented fallback).

## Approval gates (shipped)

Three gates pause the agent before anything consequential. The full spec
(including the 11-item G1 card and paste-ready test cases) is in
[docs/approval-gates.md](docs/approval-gates.md).

| Gate | Pauses before | Severity |
|---|---|---|
| **Verify** | Untrusted code runs in the sandbox | irreversible |
| **Publish** | The review draft is released (export stays locked without it) | irreversible |
| **Save** | Annotations are bulk-merged into the permanent library | reversible |

Shipped enforcement:

- **Identity confirm** — Allow enables only after the operator types the
  repo owner supplied by the verifier payload and holds for 3 seconds.
  When the payload omits the owner, the check fails closed (Allow stays
  disabled); nothing is inferred or fabricated client-side.
- **Server-side TTL** — pending approvals expire (5 min dev / 15 min live).
  Expiry is atomic at the decision point: a late or direct allow on an
  overdue gate is rejected (409) and the row flips to `expired`; the paused
  turn is resumed with a deny so the agent never sits stranded. A
  press-and-hold in progress is cancelled the moment the countdown hits zero.
- **Kill switch** — every gate card carries an abort action that denies the
  pending tool call.
- **Replay supersession** — replaying a run supersedes any pending gate
  (expired + denied upstream), so a stale approval can never fire against a
  newer session.
- **Resource envelope honesty** — the Verify card renders budget/envelope
  values from the verifier's payload; when a value is unspecified it renders
  "—" rather than a reassuring placeholder.

## Runtime guardrails

- **Cap guard** — a per-paper USD/token budget hard-stops the run when
  exceeded (the token cap governs providers reporting zero cost): red chip,
  run halted, audit row written.
- **Halt** — one control, two states. Pause suspends the live stream; Stop
  terminates the upstream turn and locks the run — a halted run refuses
  further streams, approvals, and replays-with-side-effects.
- **Auth & ownership** — every API route verifies the caller's session and
  row ownership; SSE streams additionally verify the paper's session/turn
  match. Rate limits guard auth endpoints.
- **Secrets** — `.env` is gitignored; the in-app banner (or `npx tsx
  cli/init-key.ts KEY=VALUE`) writes keys locally. The sandbox never
  receives host secrets.

## Reporting

Please open a GitHub issue for non-sensitive reports. For sensitive issues,
contact the maintainers via the email listed in the repo's `maintainers` field
once Phase 0 wiring is complete.
