# Security

Recap handles three classes of untrusted input and one class of untrusted
execution. This document summarizes the model. The full threat model and
gate-by-gate behavior live in [docs/approval-gates.md](docs/approval-gates.md).

## Untrusted input

- **Paper PDFs** — uploaded by the user; parsed but not executed.
- **arXiv / OpenAlex responses** — fetched over HTTPS; treated as data, not code.
- **Paper repository URLs** — referenced by the agent when the user runs Review
  mode. Outbound HTTP is allowlisted to the paper's own host and to PyPI.

## Untrusted execution

Paper code is **never** executed in the Next.js process or in TrueForge's
primary container. It runs only inside an ephemeral Daytona sandbox with
egress allowlisted to (a) arXiv, (b) the paper's repo URL, and (c) PyPI. The
sandbox is destroyed at turn end.

## Approval gates (summary)

Three gates pause the agent before any irreversible action. The full spec
(including the G1 card and paste-ready test cases) is in
[docs/approval-gates.md](docs/approval-gates.md).

| Gate | Pauses before | Reversible? |
|---|---|---|
| **Verify** | Untrusted code runs in the sandbox | reversible — abort, no side effect |
| **Publish** | Annotation is written to the paper workspace | reversible — delete annotation |
| **Save** | Audit snapshot is committed to the DB | reversible — drop the row |

## Reporting

Please open a GitHub issue for non-sensitive reports. For sensitive issues,
contact the maintainers via the email listed in the repo's `maintainers` field
once Phase 0 wiring is complete.
