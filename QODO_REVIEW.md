# Qodo Code Review Evidence

Recap is built under the Qodo Code Quality track (Q Branch) and the Savile Row
Best UI track. Every substantive change lands through a pull request reviewed
by the Qodo GitHub App before merge. Direct pushes to `main` are not used.

## Qodo App install (one-time, per team)

The Qodo GitHub App is installed at the team level (not per-repo). Verified
install URL (slug `qodo-code-review`, owner `qodo-ai`, app ID 484649,
probed 2026-08-26 via the live API after install):

**https://github.com/apps/qodo-code-review/installations/new**

Alternative path via the Qodo portal:

1. Open the Qodo portal → **Integrations** → **SaaS** → **GitHub**.
2. Click **Add installation**. The 14-day trial needs no credit card.
3. Authorize the GitHub org or user that owns this repo.
4. One installation per team is enough; it covers every repo in scope.

### How to trigger the first review on an already-open PR

Qodo's automatic review triggers are **PR opened, reopened, or marked
ready for review** — **not** App installation (Qodo's docs:
https://docs.qodo.ai/code-review/use-qodo-in-prs). If a PR is already open
when the App is installed, do one of:

- Comment **`/agentic_review`** on the PR (the documented PR-Agent fallback;
  see https://docs.pr-agent.ai). This is what triggered the first review
  on PR #1 in this repo.
- Or close the PR and reopen it, which fires the `reopened` trigger.
- Or mark it ready for review if it was previously a draft.

## Status as of Phase 0

- **App installed on `puri-adityakumar/openwrite`:** _MITIGATED — App live
  since 2026-08-27, review on PR #1 triggered via `/agentic_review`_.
- **First PR (reviewed, awaiting merge):**
  [#1 — chore(deps): install tsx](https://github.com/puri-adityakumar/openwrite/pull/1)
  on branch `chore/install-tsx`. Qodo posted a `COMMENTED` review with
  one bug finding about the install-trigger wording in this file; the fix
  is on the same branch in a follow-up commit.
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
