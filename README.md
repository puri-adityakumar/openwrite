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

## Quickstart

```bash
git clone https://github.com/puri-adityakumar/openwrite.git
cd openwrite
cp .env.example .env       # then fill in keys
npm install
docker compose up          # the only setup command beyond install
```

After `npm install`, the only setup command is `docker compose up` (see the
100% local standing constraint in [docs/README.md](docs/README.md)). When
the containers are up, open http://localhost:13000.

The demo credentials on the landing page are visible by default
(`demo@local / demo1234`) so a tired judge is one click from the cockpit.

## Qodo Code Review Evidence

Every substantive change lands through a pull request reviewed by the Qodo
GitHub App before merge. The full Qodo review policy and the install URL
are in [QODO_REVIEW.md](QODO_REVIEW.md).

**Phase 0 bootstrap:** the Qodo App is not yet installed on this repo
(requires a one-time human action in the Qodo portal). Phase 0 was pushed
directly to `main` per the phase plan's install-steps-noted fallback. All
Phase 1+ code will land through Qodo-reviewed PRs, and the first such PR
will be linked here.

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
