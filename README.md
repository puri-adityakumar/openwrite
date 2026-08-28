# Recap — a research-paper autopsy you can drive

> One command, three verbs, six surfaces, zero surprises.
> Built for the WeMakeDevs × TrueFoundry Agent Harness Hackathon (Savile Row track).

Recap takes a research paper — arXiv URL or uploaded PDF — and drives a
TrueForge-backed agent that dissects it into a live Trail, a Coverage grid,
a Claims↔Evidence table, an Authors tab, and a downloadable Audit. Three
approval gates (Verify, Publish, Save) pause the agent before anything
irreversible; the Verify gate forces the user to type the repo owner and
hold for three seconds before the paper's untrusted code runs in a Daytona
sandbox. First paint is a populated demo run, not an empty state.

Full product spec: [docs/product.md](docs/product.md).
Full architecture: [docs/architecture.md](docs/architecture.md).
Security model: [SECURITY.md](SECURITY.md). What is real vs previewed
today: [TECHNICAL.md](TECHNICAL.md). New here? The **ⓘ How it works**
button on the dashboard walks the seven surfaces with screenshots.

## Quickstart

```bash
git clone https://github.com/puri-adityakumar/openwrite.git
cd openwrite
cp .env.example .env       # then fill in keys
npm install
docker compose up          # the only setup command beyond install
```

`docker compose up` brings up Postgres, Redis, and the `recap-db-init`
sidecar that applies `schema.sql` + `seed.sql`. The cockpit first paint
renders from `seed_audits` against this stack — no external services,
no sibling checkouts, no other setup steps. This satisfies the project's
[standing 100%-local constraint](docs/README.md).

### Opt-in: bring up the TrueForge server too

The TrueForge `server` service is gated behind the `trueforge` Compose
profile. A default `docker compose up` does **not** build or start it,
because the build context (`${TF_SOURCE_DIR:-../trueforge}`) lives
outside this repository and is not part of the demo path. To exercise
the live audit path, clone TrueForge as a sibling repo and bring the
server up explicitly:

```bash
git clone https://github.com/truefoundry/trueforge.git ../trueforge
docker compose --profile trueforge up
```

See [docker-compose.trueforge.yml](docker-compose.trueforge.yml) for the
port mapping (server on host 8791 → container 8790, Postgres on 5433,
Redis on 6380).

After `npm install`, the only setup command is `docker compose up` (see the
100% local standing constraint in [docs/README.md](docs/README.md)). When
the containers are up, open http://localhost:13000.

The demo credentials on the landing page are visible by default
(`demo@local / demo1234`) so a tired judge is one click from the cockpit.

### Environment keys (power-user path)

The in-app banner walks you through any missing keys at runtime (with a
copyable one-liner). If you prefer the terminal,
`npx tsx cli/init-key.ts DAYTONA_API_KEY=… GMI_API_KEY=…` upserts keys
into `.env` — seeding it from `.env.example` when it doesn't exist yet.

## Qodo Code Review Evidence

Every substantive change lands through a pull request reviewed by the Qodo
GitHub App before merge. The full Qodo review policy and the install URL
are in [QODO_REVIEW.md](QODO_REVIEW.md).

**First PR (merged):** [#1 — chore(deps): install tsx so parity and demo
scripts resolve to a real
binary](https://github.com/puri-adityakumar/openwrite/pull/1), squash-merged
as `e7f39e0`. Qodo posted a `COMMENTED` review with **1 bug finding** about
the install-trigger wording in `QODO_REVIEW.md` and `README.md` (the docs
claimed App install alone would trigger the review; it doesn't — the
correct triggers are PR open / reopen / ready-for-review, or the
`/agentic_review` comment fallback). The fix is in commit `0b936bd` on the
same branch and the re-review marked the bug ✓ Resolved. The branch
`chore/install-tsx` was deleted on merge.

**Representative substantive review (merged):** [#11 — feat(phase-4):
approval gates + phase-5 control
surfaces](https://github.com/puri-adityakumar/openwrite/pull/11). Qodo
returned **17 findings across two review passes**; every one was triaged
in-thread — 9 fixed test-first (atomic approval-TTL guard, deny-on-expiry
with paper bookkeeping, pause-suspends-stream registry, retryable stop,
cap-event dedupe, replay gate supersession, expired-publish lock, hold
cancellation at TTL 0, empty-tool-call-id guard), the stale-vs-HEAD ones
answered with the closing commit and test, and the remaining deferrals
documented. The PR merged only after the full suite went green
(226/226 unit, 54/54 E2E). This fix-then-merge loop is the project norm:
PRs #3–#10 followed the same Qodo-review gate.

**Phase 0 bootstrap:** the four initial commits on `main` (`a203040`,
`1ed94ba`, `173ceda`, `a734b64`) were pushed directly to establish the
repo, per the phase plan's install-steps-noted fallback
(`docs/plan/phase-0-decisions-and-scaffold.md` sub-phase 0.2 verification).
All subsequent code lands through Qodo-reviewed PRs.

## AI use disclosure

Recap is a hackathon project built with substantial AI assistance:

- The documentation in [docs/](docs/) was drafted and cross-checked by an
  agent loop (see [docs/research/iteration-log.md](docs/research/iteration-log.md)).
- Source code is written by an Orchestrator agent with specialist subagents
  under a strict TDD loop, as defined in
  [docs/plan/README.md](docs/plan/README.md).
- The project is open source so judges can read every decision.

Per the hackathon rules, all participants understand and can explain every
line of code in their submission.

## License

MIT — see [LICENSE](LICENSE). Third-party notices in
[LICENSES.thirdparty.txt](LICENSES.thirdparty.txt).
