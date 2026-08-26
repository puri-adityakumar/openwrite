# Qodo Code Review Evidence

Recap is built under the Qodo Code Quality track (Q Branch) and the Savile Row
Best UI track. Every substantive change lands through a pull request reviewed
by the Qodo GitHub App before merge. Direct pushes to `main` are not used.

## Qodo App install (one-time, per team)

The Qodo GitHub App is installed at the team level (not per-repo) via the
Qodo portal:

1. Open the Qodo portal → **Integrations** → **SaaS** → **GitHub**.
2. Click **Add installation**. The 14-day trial needs no credit card.
3. Authorize the GitHub org or user that owns this repo.
4. One installation per team is enough; it covers every repo in scope.

If Qodo is not active on a given PR, comment `/agentic_review` on the PR and
Qodo will run a review pass on demand. This is the documented fallback for
PR-Agent (see https://docs.pr-agent.ai).

## How we use Qodo

- **Every PR** for product code, infrastructure, and schema changes is
  reviewed by Qodo before merge.
- **High-severity findings** are either fixed in the same PR or dismissed
  in-thread with a written reason.
- **Re-run after edits**: a push to the PR branch re-triggers review; we do
  not merge while a High is open.

## Evidence

The README's `## Qodo Code Review Evidence` section links to representative
merged PRs and summarizes findings and resolutions. Screenshots do not
replace the link; judges can inspect any merge in the PR list.
