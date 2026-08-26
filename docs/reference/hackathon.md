# Hackathon Reference (verified Aug 26, 2026)

- **Site:** https://www.wemakedevs.org/hackathons/trueforge (+ `/rules`, `/schedule`, `/resources`)
- **Sponsor:** WeMakeDevs × TrueFoundry. "The Agent Harness Hackathon." James Bond theme ("File TF-007").
- **Registration:** https://forms.gle/dNHFh7wH8uJj4bZH8 · **Discord:** https://discord.gg/wemakedevs · **SF day:** https://luma.com/agent-harness

## Tracks and prizes

| Track | Prize | Note |
|---|---|---|
| Double-O (Best Use of TrueForge) | NVIDIA DGX Spark ($5,000, winning team) | judged |
| Q Branch (Best Code Quality, by Qodo) | Mac Mini ($1,000) | judged |
| **Savile Row (Best UI)** | **iPad to every team member** | **← our target** |
| Field report (best blog post) | Keychron keyboard to one writer | open |
| Radio traffic (top-10 social posts) | swag to ten people | open |
| Universal Exports | interviews at TrueFoundry for top projects | — |

**One team can win only one judged track; all submissions are considered for all three.**

## Format

Free, online from anywhere; solo or teams ≤ 4; must be open source (public repo
judges can READ and RUN); building happens during the week (planning beforehand
OK); AI tools allowed but must be disclosed; participants must understand their
code; fully-AI-generated projects may be rejected.

## Submission (via the WeMakeDevs site — NO Devpost)

1. Public repo + clear README with setup steps a judge can follow
2. Demo video ~3 minutes showing the agent working
3. Short write-up of what the agent does + how it uses TrueForge
4. `## Qodo Code Review Evidence` section in README

**Judges must see:** "TrueForge reaching a tool, running code in the sandbox,
and stopping for a person." **No hosting required** — judges clone + run locally
per the README. **Own model API key required** (unless attending SF day) —
GMI/MiniMax M3 via GMI Cloud solves this (OpenAI-compatible custom provider, no
rate-limit anxiety vs. the Gemini free tier).

## Savile Row wording (verbatim)

> "For the team whose agent is something a stranger could pick up and drive. An
> interface that shows what the agent is doing, what it is waiting on, and what
> it did, and asks before the irreversible step rather than after it. Judged on
> the demo video and on the running project, not on a screenshot."

## Qodo review rules (mandatory)

- Every substantive change goes through a PR reviewed by Qodo before merge
  ("Direct pushes to main do not count").
- Setup once per team via Qodo portal → Integrations > SaaS > GitHub > Add
  installation (14-day trial, no card; one installation per team is enough).
- If Qodo doesn't start, comment `/agentic_review` on the PR.
- Fix every valid High-severity finding, or dismiss it in the Qodo thread with
  a reason, then re-run review.
- README must contain a `## Qodo Code Review Evidence` section linking ≥1
  representative merged PR plus 1–2 sentences on findings/resolutions;
  screenshots can't replace the link; judges may inspect other merges.
- Qodo open-source program: https://www.qodo.ai/solutions/open-source/ ·
  PR-Agent docs: https://docs.pr-agent.ai

## Official project ideas (verbatim) — for positioning

1. **Approval-gated assistant** — drafts email / files ticket / books trip; nothing irreversible until approved. Reaches Gmail or Slack.
2. **Analytics agent** — plain-English question → writes SQL, runs it, explains. Reaches your database.
3. **Code review agent** — reads a PR, runs the test suite in a sandbox, comments. Reaches GitHub.
4. **Research desk** — subagents across the web on one question, merges with sources. Reaches web search.
5. **Incident responder** — investigates an alert read-only, asks before restarting/rolling back. **Badged "Hero project."** Reaches your cloud.
6. **Untrusted code runner** — runs submitted code in an isolated sandbox, returns the result safely.

Recap fuses #2 + #5 (and #6 via the Verify gate).

## The 10 example agents in the official cookbook

Verified at `github.com/truefoundry/trueforge/tree/examples/agent-cookbook/examples`:

- `security-auditor` (GitHub + Exa — verified repo security report)
- `db-analyst` (**Supabase MCP + supabase/jupyter skills** — plain-language Postgres analysis) ← closest starting point
- `bring-your-own-mcp` (weather MCP starter template)
- `ci-fixer` (GitHub + gh-fix-ci skill)
- `claim-red-teamer` (Exa — fact-checks claims)
- `codebase-onboarding` (DeepWiki + GitHub)
- `decision-brief` (Exa — sourced comparison brief)
- `incident-investigator` (Sentry)
- `issue-triage` (Linear)
- `knowledge-capture` (Notion)
