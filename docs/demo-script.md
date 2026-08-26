# Demo Script — 3 minutes, beat-by-beat

Rehearsed **twice on the iPad model the judges will use** (Sat evening, Phase 7).
Second-device check: Safari at 1024×768, first-paint render < 2 s.
QODO_REVIEW.md is called out in the 0:30 "Powered by" beat.

## The 12 rows

| Time | What the judge sees | What the narrator says |
|---|---|---|
| 0:00 | Dr. K anchor card slides in: 40 preprints/week, 9h → 47 min, 2 sends blocked | "Forty pages. Two hours. The week doesn't have it. Recap is the receipt for a paper you have to read." |
| 0:15 | Terminal cut: `git clone` + `docker compose up` + open browser → populated /dashboard | "I cloned this. I ran docker compose up. I'm already signed in." |
| 0:30 | "Powered by" logos (TrueForge, Daytona, GMI, Qodo) with QODO_REVIEW.md callout | "Powered by TrueForge, Daytona, GMI, Qodo. Each one visible in the stack." |
| 0:45 | /paper/new with a real arXiv URL pasted. "Detected: 2401.12345." Click Review → Start | "Drop a paper. Pick a verb. Recap does the rest." |
| 1:00 | Trail pulses through Source → Parse → Extract → Score. Coverage grid fills. Pulse streams events | "Watch the Trail. The agent is reading, parsing, extracting, scoring, verifying." |
| 1:30 | Verify gate card slides in. Status row flips verb-first | "Found 3 claims that need your sign-off." |
| 1:45 | G1 spec rendered | "Provenance, intent, resource budget, sandbox envelope, risk flags, kill switch, identity confirm. Type the repo owner. Hold three seconds." |
| 2:00 | Publish diff card: "Reproduced 91.7% (claimed 92.4%, Δ −0.7)" | "Approve. Daytona runs the paper's untrusted code in a fresh, network-off, seccomp'd sandbox." |
| 2:15 | Audit tab → click Replay → new session spins | "Every event is auditable. Click Replay to re-run the same claim set on a fresh sandbox." |
| 2:30 | Banner: "Daytona key missing — sandbox preview only." Trail completes | "Sandbox preview mode runs the same flow without Daytona — for keys you don't have." |
| 2:45 | Cap chip turns red. Halt 2-state. Audit log unchanged | "Cap hits its limit. Halt. Resume. Audit stays intact." |
| 3:00 | "/" + repo URL on screen | "One command. Three verbs. Six surfaces. Zero surprises." |

## The 60-second stranger test (acceptance test for "Best UI")

```
t=0     Judge runs `git clone git@github.com:you/recap.git && cd recap && docker compose up`
t=45s   Docker pulls TrueForge + Postgres + Redis; TrueForge boots on :18790; Next.js starts on :13000
t=50s   Judge opens http://localhost:13000 — sees the Recap landing (left: pitch + Dr. K anchor; right: sign-in card). demo@local / demo1234 printed under the card.
t=55s   Judge clicks "Sign in" with the seed creds. Cookie set; redirects to /dashboard.
t=58s   /dashboard loads with the populated run card for the seeded paper. Floating "Tour" button hovers in the corner.
t=60s   Judge clicks the populated run card → /paper/attention-is-all-you-need → first paint shows: Trail (all 6 pills green), Coverage (full grid), Summary tab populated, Pulse (5 lines). The judge gets it.
```

This test is run cold with two strangers on Saturday AM (Phase 6) and again as
the Phase 7 exit gate. **Any fumble is a P0 bug.**
