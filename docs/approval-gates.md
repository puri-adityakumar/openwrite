# Approval Gates — Verify · Publish · Save

Three approval gates pause the agent **before** anything irreversible. This file
is the binding spec for Phase 4 and is referenced by the build schedule and the
demo script.

| Gate | Severity | What it gates |
|---|---|---|
| **Verify** | irreversible | Running the paper's untrusted code in the Daytona sandbox. Full G1 spec below. |
| **Publish** | irreversible | Review-mode draft as a downloadable markdown. Before/after diff. |
| **Save** | reversible | Bulk-merging annotations into the permanent library. |

Persistence: every `tool.approval_required` event writes
`(threadId, toolCallId, gate)` to the `gates` table. Resume = **new turn on the
same `threadId`** with a `user.tool_approval` input item
(`{threadId, toolCallId, approval:{status:"allow"}|{status:"deny",reason}}`).
The resume turn's input **cannot mix** approval with `user.message`.

Approval TTL is server-side, likely 5–30 min. The card shows a visible
countdown; on expiry treat as `deny` with "approval expired — restart
verification" and set `gates.status = 'expired'`.

## G1 — Verify approval card spec (must show ALL of the following)

1. **Provenance** — arXiv ID, title, authors, fetch timestamp, source URL with
   SHA-256, GitHub repo URL with commit SHA.
2. **Declared intent** — one-sentence description of what the run will do.
3. **Command verbatim** — the exact command to be executed.
4. **Resource budget** — CPU/RAM/disk caps, wall-clock timeout, network mode,
   exact egress allowlist.
5. **Sandbox envelope** — microVM/hypervisor, base image digest, seccomp
   profile, UID, mount table, ephemerality.
6. **Risk flags (auto-generated)** — presence of `setup.py`, Makefile,
   `\write18`-style macros, large downloads, network calls.
7. **Data scope** — files readable; explicit "cannot read ~/.ssh, ~/.aws,
   browser profile, home directory."
8. **Persistence** — "nothing survives this run except stdout/stderr log, the
   workspace tarball, and Postgres rows tagged with run_id."
9. **Kill switch** — button on the card.
10. **Identity confirm** — type the repo owner + hold for 3 seconds.
11. **Liability note.**

Card chrome: `◀ Verify gate · irreversible · expires in M:SS` header;
`[ Allow ] [ Edit ] [ Deny ]` actions.

## Paste-ready test cases

Use these verbatim in Phase 4 E2E tests and in the demo rehearsal.

### TC-1 — Allow path (happy path)

1. Start a Review-mode run on the seeded fixture paper.
2. Wait for the Verify gate card. Assert: header shows `irreversible` and a
   countdown; all 11 G1 items render; command is verbatim
   `python train.py --config configs/cifar.yaml`.
3. Type the repo owner (`tensorflow`), press-and-hold **Allow** for 3 s.
4. Assert: `gates.status = 'allowed'`, `decided_at` set; a new turn starts on
   the same `threadId` with `user.tool_approval {status:"allow"}`; the sandbox
   runs; the Audit timeline gains `✓ user allowed` and `✓ sandbox run: …` rows.

### TC-2 — Deny path

1. Reach the Verify gate as in TC-1.
2. Click **Deny**, enter reason "network mode unclear."
3. Assert: `gates.status = 'denied'`; resume turn carries
   `{status:"deny", reason}`; the agent continues **without** running code and
   marks the affected claims "unverified"; no Daytona sandbox is created
   (no `sandbox.created` event after denial).

### TC-3 — Expiry path

1. Reach the Verify gate. Do nothing until the countdown hits 0
   (test hook may shorten TTL to 5 s).
2. Assert: card flips to "approval expired — restart verification";
   `gates.status = 'expired'`; Allow/Deny buttons disabled; agent treats the
   gate as denied and offers a restart action.
