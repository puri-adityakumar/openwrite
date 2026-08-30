# Openwrite — an agent that asks permission before it touches anything

> Drop a research paper. Watch an agent dissect it — and stop at every irreversible step to ask you first.

Openwrite (working title *Recap*) is a research-paper autopsy you can drive. Hand it an arXiv URL or a PDF and a TrueForge-backed agent reads the paper, maps its structure, extracts claims with page-level evidence, profiles the authors, and streams everything into a live cockpit. Three approval gates — **Verify**, **Publish**, **Save** — pause the agent before anything irreversible: the Verify gate even makes you type the repo owner and hold a button for three seconds before the paper's untrusted code can run in a sandbox.

Built for the WeMakeDevs × TrueFoundry Agent Harness Hackathon (Savile Row track). Everything runs locally — no cloud, no signups, no hidden keys.

## Watch it

[![Openwrite demo — 3 minutes](https://img.youtube.com/vi/9iPQsysZ35k/0.jpg)](https://youtu.be/9iPQsysZ35k)

📺 **3-minute demo:** [youtu.be/9iPQsysZ35k](https://youtu.be/9iPQsysZ35k)

📝 **Write-up:** [I built an agent that asks permission before it touches anything](https://dev.to/adityawaslost/i-built-an-agent-that-asks-permission-before-it-touches-anything-299c) — the story behind the gates, the surfaces, and why "a pause you have to hold open is control."

## Features

- **One command to run** — `bash scripts/setup.sh` brings up Postgres + Redis, applies schema + seed, and starts the app.
- **Live cockpit** — the agent's progress streams over SSE: a trail of pipeline stages, a per-page coverage grid, a claims ↔ evidence table, author profiles, and a replayable audit.
- **Permission before action** — every irreversible step pauses behind a gate. The Verify gate is deliberately friction-full: type the repo owner, hold three seconds, then (and only then) does untrusted paper code touch a sandbox.
- **First paint is a real run** — a seeded demo paper renders a complete cockpit on first load, so you see the product, not an empty state.
- **100% local** — Docker Compose brings up Postgres, Redis, and the TrueForge harness. No external services required.
- **Auth built in** — local JWT + bcrypt, signup/login out of the box, demo login on the landing page.

## Quickstart

Prerequisites: [Node.js](https://nodejs.org) 20+ and [Docker](https://www.docker.com/products/docker-desktop/).

```bash
git clone https://github.com/puri-adityakumar/openwrite.git
cd openwrite
bash scripts/setup.sh
```

That's it. The script checks prerequisites, copies `.env.example` to `.env`, installs dependencies, brings up Postgres + Redis via `docker compose up`, applies `schema.sql` + `seed.sql`, and starts the dev server. If you'd rather run the steps yourself: after `npm install`, `docker compose up` is the only setup command beyond install.

Open **http://localhost:13000** and sign in with the demo account:

```
demo@local / demo1234
```

### Manual setup (same steps, spelled out)

```bash
npm install
cp .env.example .env        # defaults work for local dev
docker compose up -d        # Postgres (5433) + Redis (6380) + schema/seed sidecar
npm run dev                 # http://localhost:13000
```

To bring up the full TrueForge server too (needed for the live agent path — the seeded demo path works without it):

```bash
git clone https://github.com/truefoundry/trueforge.git ../trueforge
docker compose --profile trueforge up
```

### Environment keys

`cp .env.example .env` gives you working defaults for local dev. The optional keys:

| Variable | Needed for | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection | `postgres://trueforge:trueforge@localhost:5433/recap` |
| `REDIS_URL` | Rate limiting | `redis://localhost:6380` |
| `JWT_SECRET` | Auth sessions | `change-me-to-a-long-random-string` |
| `TRUEFORGE_BASE_URL` | Live agent harness | `http://localhost:18790` |
| `GMI_API_KEY` / `GMI_MODEL` | Live LLM provider (Anthropic `/v1/messages` format via GMI Cloud) | — |
| `DAYTONA_API_KEY` | Ephemeral sandboxes | — |
| `GITHUB_TOKEN` | Optional: GitHub MCP for the agent | — |

The in-app `.env` banner walks you through any missing keys at runtime.

## Architecture

```
┌──────────────┐   SSE / HTTP    ┌────────────────────┐   tool calls    ┌──────────────────────┐
│   Browser    │ ───────────────►│  Next.js app       │ ───────────────►│  TrueForge server    │
│   :13000     │ ◄───────────────│  (this repo)       │ ◄───────────────│  :18790 (docker)     │
│  cockpit UI  │  events, gates  │  /api/* routes     │   approvals      │  agent loop, gates,  │
└──────┬───────┘                 └────┬───────────────┘                  │  replay, sandbox     │
       │                             │                                   └──────────┬───────────┘
       │   Postgres (5433)           │                                                │ HTTPS
       │   users, papers, audit,     │                                                ▼
       │   gates, seed_audits        │                                    ┌──────────────────────┐
       └─────────────────────────────┘                                    │  LLM providers       │
       Redis (6380) — rate limits    ◄───────────────────────────────────┤  GMI / MiniMax M3    │
                                                                          └──────────────────────┘
```

```mermaid
flowchart LR
    B[Browser<br/>localhost:13000] -->|SSE events / gate decisions| N[Next.js app<br/>cockpit + API routes]
    N -->|createTurnStream / respondToApproval| T[TrueForge server<br/>localhost:18790]
    T -->|tool execution| S[Daytona sandbox<br/>untrusted paper code]
    T -->|model calls| G[GMI Cloud<br/>MiniMax M3]
    N -->|pg| P[(Postgres<br/>users · papers · gates · audit · seed_audits)]
    N -->|redis| R[(Redis<br/>rate limiting)]
    P -->|schema.sql + seed.sql<br/>recap-db-init sidecar| C[(docker compose)]
```

- **Frontend** — Next.js (App Router) + React 19 + Tailwind v4 on `:13000`. The cockpit renders the agent's live run: trail, coverage grid, claims table, authors, audit.
- **Agent harness** — TrueForge in Docker (`:18790`). It runs the agent loop, streams events over SSE, pauses for approvals, and handles replay/persistence.
- **Storage** — Postgres on `:5433` (same container family as TrueForge) with a `recap-db-init` sidecar that applies `schema.sql` + `seed.sql` idempotently. Redis on `:6380`.
- **Sandbox** — Daytona, ephemeral per turn, with an egress allowlist (arXiv + the paper's repo + PyPI). A local sandbox fallback engages when no sandbox provider is configured.
- **LLM** — GMI Cloud as a custom Anthropic-format provider (`MiniMaxAI/MiniMax-M3`), BYO key.

## API

All routes live under `/api`, scoped to the signed-in user.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/auth/signup` | Create account (bcrypt → `users`) |
| `POST` | `/api/auth/login` | Sign in → JWT cookie |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/env-status` | Which env keys are configured (powers the banner) |
| `GET` / `POST` | `/api/papers` | List / create papers |
| `GET` | `/api/papers/:id/pdf` | Served source PDF |
| `GET` | `/api/papers/:id/authors` | OpenAlex author profiles |
| `GET` | `/api/papers/:id/claims` | Extracted claims + evidence |
| `GET` | `/api/papers/:id/gates` | Approval gates for a paper |
| `GET` | `/api/papers/:id/audit` | Audit trail events |
| `POST` | `/api/papers/:id/ask` | Ask the paper a question (cited answers) |
| `POST` | `/api/agent/start` | Start a run → TrueForge session + first turn |
| `POST` | `/api/agent/approve` | Resume a paused turn (approve a gate) |
| `POST` | `/api/agent/halt` | Pause / stop the run |
| `GET` / `POST` | `/api/agent/replay` | Replay a run in a fresh sandbox |
| `POST` | `/api/agent/stream` | SSE stream of live run events |
| `GET` | `/api/agent/gates/:id` | Gate detail + status |

### The approval flow

1. The agent hits an irreversible action → TrueForge emits `tool.approval_required`.
2. Openwrite persists the gate and shows the countdown card in the cockpit.
3. The user approves/denies → `respondToApproval` resumes the turn on the same `threadId`.
4. `turn.done` with pending `requiredActions` is **paused on gate**, never "done".

## Project structure

```
app/                Next.js App Router — pages + API routes
components/         Cockpit, gates, tabs (summary/claims/authors/graphs), landing
lib/                DB, session, event reducer, TrueForge + OpenAlex clients
scripts/            setup.sh, smoke checks, demo recorder
tests/              Vitest unit suite (232 tests)
e2e/                Playwright end-to-end specs
docs/               Product spec, architecture, approval-gate spec, handovers
schema.sql          Single source of truth for the DB schema
seed.sql            Demo user + seeded first-paint run
docker-compose.yml  Postgres + Redis + schema/seed init sidecar
```

## Testing

```bash
npm test          # Vitest unit suite (includes DB-backed tests)
npm run parity    # seed-vs-live schema drift guard
npx tsc --noEmit  # typecheck
npx playwright test  # E2E suite (needs the dev server running)
```

CI runs typecheck, the unit suite, and the parity guard on every PR (Postgres provisioned via a GitHub Actions service).

## Docs

- [Product spec](docs/product.md) — identity, vocabulary, rubric
- [Architecture](docs/architecture.md) — stack, diagram, routes, DB schema, SSE flow
- [Approval gates](docs/approval-gates.md) — Verify / Publish / Save spec
- [Security model](SECURITY.md) — threat model and sandboxing
- [TECHNICAL.md](TECHNICAL.md) — what is real vs previewed

## Tech stack

Next.js 16 · React 19 · Tailwind v4 · TypeScript · Postgres · Redis · TrueForge agent harness · Daytona sandbox · GMI Cloud (Anthropic-format) · OpenAlex / arXiv data · Vitest + Playwright + GitHub Actions.

## Qodo Code Review Evidence

Every substantive change lands through a pull request reviewed by the Qodo GitHub App before merge. The full Qodo review policy and the install URL are in [QODO_REVIEW.md](QODO_REVIEW.md). Notable reviews: [#14 — feat(phase-7): wire app to real TrueForge + GMI](https://github.com/puri-adityakumar/openwrite/pull/14) (Qodo: "Great, no issues found!") and [#11 — approval gates + phase-5 control surfaces](https://github.com/puri-adityakumar/openwrite/pull/11) (17 findings, all triaged, 9 fixed test-first).

## License

MIT — see [LICENSE](LICENSE). Third-party notices in [LICENSES.thirdparty.txt](LICENSES.thirdparty.txt).

---

Made for the WeMakeDevs × TrueFoundry Agent Harness Hackathon. Open source so judges (and you) can read every decision.
