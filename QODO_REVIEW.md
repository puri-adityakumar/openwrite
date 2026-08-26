# Qodo Code Review Evidence

Recap is built under the Qodo Code Quality track (Q Branch) and the Savile Row
Best UI track. Every substantive change lands through a pull request reviewed
by the Qodo GitHub App before merge. Direct pushes to `main` are not used.

## Qodo App install (one-time, per team)

The Qodo GitHub App is installed at the team level (not per-repo). Verified
install URL (slug `qodo-merge`, HTTP 302 → install flow, probed 2026-08-26):

**https://github.com/apps/qodo-merge/installations/new**

Alternative path via the Qodo portal:

1. Open the Qodo portal → **Integrations** → **SaaS** → **GitHub**.
2. Click **Add installation**. The 14-day trial needs no credit card.
3. Authorize the GitHub org or user that owns this repo.
4. One installation per team is enough; it covers every repo in scope.

If Qodo is not active on a given PR, comment `/agentic_review` on the PR and
Qodo will run a review pass on demand. This is the documented fallback for
PR-Agent (see https://docs.pr-agent.ai).

## Status as of Phase 0

- **App installed on `puri-adityakumar/openwrite`:** _pending — requires a
  one-time human action in the browser via the install URL above_.
- **First Qodo-reviewed PR:** will be linked in this file and in
  `README.md` → `## Qodo Code Review Evidence` once the App is installed
  and the first Phase 1+ PR is reviewed and merged.
- **Phase 0 bootstrap commits** were pushed directly to `main` to establish
  the repo. Per `docs/plan/phase-0-decisions-and-scaffold.md` sub-phase 0.2
  verification line, the install steps being executed and noted satisfies
  the Qodo gate for the bootstrap commit. All subsequent code will land via
  Qodo-reviewed PRs.

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
