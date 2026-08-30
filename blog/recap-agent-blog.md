# I built an agent that asks permission before it touches anything

Every agent demo I watched this month had the same ending: the agent clicked "confirm" on itself. Nobody in the video batted an eye. The narrator called it "fully autonomous" and moved on.

That's the part I can't get past. An agent that never stops isn't autonomous, it's just unattended.

So for the WeMakeDevs × TrueFoundry Agent Harness Hackathon, I built Recap: a research-paper autopsy you can drive. You hand it a paper, it dissects it, and every time it wants to do something irreversible, it stops and waits for you. The agent supervises papers. You supervise the agent.

Repo: https://github.com/puri-adityakumar/openwrite

## The job I gave it

Research papers are a triage problem. You don't read one paper, you triage forty, and most of them don't deserve the forty minutes. The job I gave the agent: take an arXiv URL or a PDF, and come back with the parts a human actually needs. Not a summary. A workup.

![The landing page](blog/images/01-landing.png)

*One click from landing to cockpit. The demo credentials sit right there because a tired judge is a real user segment.*

What comes back is five surfaces: a live Trail of everything the agent did, a Coverage grid, a Claims↔Evidence table, an Authors tab, and a downloadable Audit. The Claims↔Evidence table is the one I'd want as a reviewer. Every claim in the paper, next to the evidence the agent found for it, and the gaps in between.

![The dashboard](blog/images/02-dashboard.png)

*The dashboard. First paint shows a populated run, not an empty state. Empty states are where demos go to die.*

## The pause is the product

Here's the feature I actually care about: three approval gates. Verify, Publish, Save. Before the agent does anything irreversible, it pauses and asks. Not a toast you can ignore. A full stop.

The Verify gate is deliberately obnoxious. Before the paper's untrusted code runs in a sandbox, you have to type the repo owner's name AND hold a button for three full seconds. That's not friction by accident. That's friction on purpose. Papers are not trusted code, and "run the repo this paper links to" deserves a speed bump.

![The verify gate](blog/images/05-verify-gate.png)

*The Verify gate. Type the owner, hold for three seconds. If it feels excessive, try imagining what the code does.*

Annoying answer: most agent safety demos are theater. A checkbox nobody reads is consent, not control. A pause you have to hold open is control.

## Wiring it up

The stack is boring on purpose: Next.js, Postgres, Redis, one `docker compose up`, everything local. The interesting wiring is the agent harness.

One command, no clone:

```bash
npx @truefoundry/trueforge@latest
```

That gives me a TrueForge server on localhost:8790. Then I registered GMI Cloud as the model provider, pointed at their Anthropic-compatible endpoint with a custom base_url, running MiniMax-M3. No adapter code. A curl with a manifest, done.

![The cockpit mid-run](blog/images/04-cockpit-running.png)

*The cockpit mid-run. Real SSE events streaming in: turn created, deltas, tool calls. The Trail on the left is the agent's actual receipt.*

My app talks to TrueForge through its REST + SSE API. `lib/trueforge.ts` ships an HttpTrueForgeClient, and the events come over the wire for real: `turn.created`, `model.message.delta`, `tool.approval_required`, `turn.done`. When a gate fires, my UI surfaces the pause, and your allow/deny decision routes back to TrueForge through its resume contract. Nothing in the hot path is mocked. There's a smoke script that proves the "pong" in the transcript came from the actual model.

## What TrueForge took off my plate

This is the list I'd have underestimated a week ago:

- The agent runtime itself: turn lifecycle, retries, cancellation. I would have hand-rolled a state machine and shipped at least two race conditions.
- Event streaming. SSE with backpressure and reconnection is a project, not a file.
- Model-provider plumbing. Swapping GMI in without writing an adapter was the single best "oh, that's it?" moment of the hackathon.
- The approval-pause/resume contract. The hard part of human-in-the-loop isn't the UI, it's freezing a running turn and resuming it correctly after a human decides. That's a solved problem here, and I just used it.
- Sandbox handling, with a local fallback when no cloud sandbox is configured.

I wrote the surfaces: gates, trail, audit, the cockpit UI. TrueForge ran the agent underneath them. That division of labor is the whole pitch.

## Where it broke

The low point: the demo ran fine until tool execution. Daytona, the sandbox provider, kept refusing the write that publishes a sandbox snapshot. The docs made it sound like `write:sandboxes` was enough. It isn't. You also need `write:snapshots`, and nothing tells you that until the API returns a permission error mid-demo.

The fix I reached for was TrueForge's local sandbox fallback, which auto-engages when no cloud sandbox provider is configured. The demo lived. And to be clear about the trade: tool execution behind the gate is skipped right now, and the harness says so honestly in the audit as `sandbox.disabled`. It doesn't pretend. The audit shows the gap, which is exactly the behavior I built the whole product around.

Honestly, that's the part I'm proudest of: the failure mode is visible, not hidden.

## The review loop nobody asked about

Quick one, because it shaped everything: every substantive change landed through a Qodo-reviewed pull request. Thirteen PRs, all reviewed. The approval-gates PR came back with 17 findings across two review passes, including a race condition in my event reducer and a missing TTL guard that could have double-approved a gate. Every finding triaged before merge. The loop became the norm: PR, review, fix, merge. 237 unit tests and 54 E2E tests green at the end of it.

## The whole run

If you'd rather watch than read:

**Demo clip:** https://github.com/puri-adityakumar/openwrite/blob/main/demo-recording/demo.mp4

*180 seconds, the whole run, no cuts.*

![The audit](blog/images/06-audit.png)

*The audit at the end. Every action logged, every decision attributed. If the agent did it, the audit can prove it.*

The agents are coming either way. The interesting question isn't whether they can do the work. It's whether you can see them doing it.

Repo: https://github.com/puri-adityakumar/openwrite
