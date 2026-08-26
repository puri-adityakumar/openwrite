# Product Definition — Recap

*Compiled 2026-08-26, locked after a 10-pass iteration loop with a 5-agent MoE
panel (see [research/iteration-log.md](research/iteration-log.md)).*

## Identity

- **Canonical product name (locked):** **Recap** — "to recap a paper"
- **Working/repo name:** OpenWrite → repo path `/Users/aditya/Projects/openwrite/`
  (the UI always says "Recap")
- **Track:** Savile Row (Best UI) — iPad per team member
- **Submit by:** Aug 30, 2026, 8:00 PM London (internal cutoff 5:00 PM)
- **License:** MIT

## The product in one paragraph

Recap is a research-paper autopsy you can drive. A user drops a paper — paste an
arXiv URL or upload a PDF — picks a verb (Learn / Deep-read / Review), and watches
a TrueForge-backed agent dissect the paper into a live Trail, a Coverage grid, a
Claims↔Evidence table, an Authors tab, and a downloadable Audit. Three approval
gates (Verify, Publish, Save) pause the agent before anything irreversible; the
Verify gate forces the user to type the repo owner and hold for three seconds
before the paper's untrusted code runs in a Daytona sandbox. First paint is a
populated demo run, not an empty state.

**Tagline:** One command, three verbs, six surfaces, zero surprises.

## Final rubric score (after 10 passes)

**8.17 / 10 weighted** — Impact 8, Originality 7, Technical 9, Sponsor centrality 7,
Control 10, Presentation 8. (Up from 7.5 at pass P4.) Control & Safety is the
differentiator vs. every other "AI reads PDFs" entry. Rule ① of the track wording —
"if it would work just as well as a chat box, change the project" — is directly
answered by the cockpit (see [ui-mockups.md](ui-mockups.md)).

## Locked vocabulary (5 nouns, 3 verbs)

| Term | Meaning |
|---|---|
| **Recap** | The product |
| **Paper** | A per-paper workspace (route `/paper/:slug`, pending decision D1) |
| **Trail** | 6-pill pipeline: Source · Parse · Extract · Score · Verify · Done |
| **Coverage** | Page grid, green-to-gray, "denser = more cited" |
| **Audit** | Replayable event timeline (`/paper/:slug/audit`) |
| **Learn / Deep-read / Review** | The three mode verbs |
| **Verify / Publish / Save** | The three approval gates (verbs) |

Supporting surfaces: Reader, Pulse, Ask, Halt, Cap, Tour, Sandbox preview.
Gate names are ours; the TrueForge event name `tool.approval_required` stays
TrueForge's — no collision (verified against TrueForge's `listTurnEvents` /
`turn.done` vocabulary).

## Open decisions (must be resolved in Phase 0)

| # | Decision | Options | Default (recommended) |
|---|---|---|---|
| D1 | Route name | `/paper/:slug` vs `/notebook/:slug` | **`/paper/:slug`** — v9 standardized on `Paper` because the product verb is "to recap a paper" |
| D2 | Demo creds on landing | visible plaintext vs "Show demo creds" toggle | **visible** (`demo@local / demo1234`) — removes one step for tired judges |

The orchestrator records the final call in this table (edit the Default column to
"LOCKED: <choice>") during Phase 0, Sub-phase 0.1, then propagates the choice
repo-wide in one pass.

## Scope guardrails (from pass P2 cuts)

- Drag-and-drop PDF is **deferred** — paste URL + upload button only.
- Drizzle ORM **dropped** — single `schema.sql` + `recap-db-init` container.
- Tour is a **static modal** (7 screenshots), not an interactive walkthrough.
- Halt is **2-state** (Pause → Stop), not 3-state.
- `npm run demo` is **demoted** to a one-off `seed.sql` insert (buffer restored).

## What judges must see (track wording)

"TrueForge reaching a tool, running code in the sandbox, and stopping for a
person." Every demo and every phase's verification list is aligned to this.
