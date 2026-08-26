# Technical Notes

> **Status:** Phase 0 scaffold only. No product code yet.
> The authoritative spec lives in [docs/](docs/) — this file is a thin
> pointer plus a "what is real vs scaffolded today" snapshot for reviewers
> and judges.

## What is real today

- **Repository** initialized on `main`, public at
  https://github.com/puri-adityakumar/openwrite.
- **Documentation tree** under [docs/](docs/) is the single source of truth.
- **Build plan** is a software-factory operating manual:
  [docs/plan/README.md](docs/plan/README.md).
- **Phase 0 root files** (this commit): `LICENSE`, `NOTICE`,
  `LICENSES.thirdparty.txt`, `.env.example`, `QODO_REVIEW.md`, `SECURITY.md`,
  `README.md`, `vitest.config.ts`, `playwright.config.ts` (next), a passing
  `tests/scaffold.test.ts` (RED-first TDD), and a `package.json` with the
  7 required scripts.
- **Locked decisions**: D1 = `/paper/:slug` route, D2 = visible demo creds.
  Recorded in [docs/product.md](docs/product.md).

## What is scaffolded but not yet real

- **Next.js app, TrueForge override, Postgres schema, Daytona integration** —
  Phase 1.
- **The six user screens and nine API routes** — Phases 1–5.
- **Trail, Coverage, Pulse, Reader, Ask, Audit, Export** — Phases 2–5.
- **Demo video, cold-judge test, final submission** — Phases 6–7.

## How to read the plan

1. [docs/README.md](docs/README.md) — doc map and standing constraints.
2. [docs/plan/README.md](docs/plan/README.md) — the factory manual
   (Orchestrator + 13 subagent types, TDD loop).
3. [docs/plan/phase-0-decisions-and-scaffold.md](docs/plan/phase-0-decisions-and-scaffold.md)
   — the current phase.
