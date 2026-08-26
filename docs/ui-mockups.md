# UI Mockups (plain text, locked)

These are the binding visual specs for the six screens. Spacing and copy may be
refined; layout, information hierarchy, and the labeled elements may not change
without updating this file in the same PR.

Cockpit surfaces (from the plan): **Status row** (verb-first sentence + outlined
chips + Halt), **Trail** (6 pills), **Coverage** (page grid + legend), **Tabs**
(Summary default · Claims · Authors · Audit), **Reader** (responsive 40/60
drawer: split on ≥1440 px, replaces right column below), **Pulse** (5-line
monospace SSE inspector, role-prefixed, 15 s heartbeat), **Ask** (`@cite`
tokens), **Tour** (floating CTA → static 7-screenshot modal), **Halt**
(2-state Pause → Stop), **Replay**, **Cap** (budget guard chip), **Sandbox
preview** (default when no Daytona key).

## `/` — Landing (auth split)

```
┌────────────────────────────┬────────────────────────────┐
│                            │                            │
│  Recap                     │   Sign in                  │
│                            │                            │
│  Drop a paper.             │   ┌──────────────────┐     │
│  Watch an agent            │   │  Email           │     │
│  dissect it for you.       │   │  [__________]    │     │
│                            │   │  Password        │     │
│  Dr. K reads 40            │   │  [__________]    │     │
│  preprints a week.         │   │                  │     │
│  9h → 47 min.              │   │  [ Sign in ]     │     │
│  2 sends blocked.          │   │                  │     │
│                            │   │  Need an account?│     │
│  Powered by                │   │  Create one →    │     │
│  TrueForge · Daytona       │   └──────────────────┘     │
│  GMI · Qodo                │                            │
│                            │   demo@local / demo1234    │
│                            │                            │
└────────────────────────────┴────────────────────────────┘
```

Demo credentials `demo@local / demo1234` are visible under the sign-in card
(decision D2, default: visible).

## `/dashboard`

```
─────────────────────────────────────────────────────────────
  Hi, Aditya.                                [ + New Paper ]

  ┌────────────┐  ┌────────────┐  ┌────────────┐
  │ Attention  │  │ AlphaFold  │  │ GPT-4      │
  │ is all you │  │ protein    │  │ tech       │
  │ need       │  │ folding    │  │ report     │
  │            │  │            │  │            │
  │ ✓ done     │  │ ✓ done     │  │ ✓ done     │
  │ Review     │  │ Deep-read  │  │ Learn      │
  │ 2d ago     │  │ 1w ago     │  │ yesterday  │
  └────────────┘  └────────────┘  └────────────┘
                                                          ⓘ Tour
```

## `/paper/new`

```
─────────────────────────────────────────────────────────────
   New Paper

   Source
   ┌───────────────────────────────────────────────────────┐
   │  Drop a PDF or paste an arXiv URL.                    │
   │  [ ________________________________________________ ]│
   │                                                       │
   │  Detected: arXiv 2401.12345                           │
   │  "Attention Is All You Need" — Vaswani et al.         │
   └───────────────────────────────────────────────────────┘

   Mode
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ Learn        │  │ Deep-read    │  │ Review       │
   │ summaries +  │  │ claims with  │  │ full audit + │
   │ key terms    │  │ full evidence│  │ diff + draft │
   └──────────────┘  └──────────────┘  └──────────────┘
   [selected]

                                             [ Start ]
```

## `/paper/:slug` — THE COCKPIT

```
────────────────────────────────────────────────────────────────────────────
 ◀ Dashboard   attention-is-all-you-need                        [⏸ Halt] [Cap: $0.012]
────────────────────────────────────────────────────────────────────┬─────────
 Auditing §4 — 12 of 30 sources cited.   tokens 18,402    —   ⏸ waiting  │
                                                                    │  Tabs
 Trail                                                               │  ─────
 ●─Source  ●─Parse  ●─Extract  ●─Score  ◉─Verify  ○─Done            │  Summary
                                                                    │  Claims
 Coverage                                                           │  Authors
 ░▒▒▓▓▓▒▒▒░░░▒▓▓▓▒▒░░▒▓▓▒░░▒▒▓▓▒░░ (denser = more cited)            │  Audit
                                                                    │
 Pulse (5 lines, monospace, role-prefixed)                            │  ┌─────────────────────┐
 14:02:31 [reader]    fetched §3.2 — "We propose a new simple..."    │  │ Summary             │
 14:02:34 [searcher]  found 2 related works via OpenAlex             │  │ The Transformer is  │
 14:02:38 [extractor] extracted 3 claims with evidence quotes        │  │ a new simple net-   │
 14:02:42 [reader]    reading §4.1 — "self-attention allows..."      │  │ work architecture   │
 14:02:47 [verifier]  proposing Verify gate: reproduced 91.7%       │  │ based solely on at- │
                                                                    │  │ tention mechanisms, │
 ┌─────────────────────────────────────────────────────────────────┐│  │ dispensing with     │
 │ ◀ Verify gate · irreversible · expires in 2:14                ││  │ recurrence and con- │
 │                                                                 ││  │ volutions entirely.  │
 │ Run "python train.py --config configs/cifar.yaml" from          ││  │                     │
 │ github.com/tensorflow/tensor2tensor (commit a1b2c3).            ││  │ Click a claim in the │
 │ Sandbox: fresh, network OFF, 2GB / 5 min.                        ││  │ Claims tab → Reader  │
 │                                                                 ││  │ opens side-by-side.  │
 │ Risk flags: setup.py present, no post-install hooks.            ││  └─────────────────────┘
 │                                                                 ││
 │ Type repo owner to confirm: [_________________________]         ││
 │ Hold for 3 seconds.                                             ││
 │                                                                 ││
 │ [ Allow ]  [ Edit ]  [ Deny ]                                   ││
 └─────────────────────────────────────────────────────────────────┘│
                                                                    │
 Ask anything in this paper…                            [ @cite ▾ ]  │
```

## `/paper/:slug/audit`

```
────────────────────────────────────────────────────────────────────────────
   Audit — attention-is-all-you-need                    [ Replay this audit ]
                                                          [ Export as markdown ]

  18:04:12  ▶ session started
  18:04:14  ✓ fetched arXiv metadata
  18:04:18  ✓ subagent: method-section
  18:04:24  ✓ subagent: claims-section
  18:04:31  ✓ subagent: results-section
  18:04:55  ⏸ Verify requested
  18:05:02  ✓ user allowed
  18:05:14  ✓ sandbox run: reproduced BLEU=27.3
  18:05:18  ✓ dashboard rendered

  Total tokens 18,402  ·  Cost —  ·  Duration 1m 6s
```

Note "Cost —": `total_cost_in_usd` is `0` for the GMI custom provider, so the
UI shows "—" (never "$0.00") and falls back to `total_tokens`.

## `/paper/:slug/export`

```
────────────────────────────────────────────────────────────────────────────
   Export — attention-is-all-you-need

   Review mode produced 4 pages of markdown.

   [ Download review.md ]

   Sections:
   • TL;DR
   • Claims ↔ evidence
   • Reproduction diff
   • Open questions for the author
```

## In-app `.env` banner (not a screen — global)

Shown whenever a required key (Daytona, GMI) is missing: one-line banner with a
**copyable curl** command; polls every 15 s + on window focus. Replaces the
killed `recap init-key` CLI pre-demo step (the CLI survives only as a documented
power-user path).
