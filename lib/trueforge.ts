// Phase 2.1 — TrueForge adapter boundary.
//
// This is the ONLY file in the Openwrite app that talks to the TrueForge
// server (the harness that runs in Docker at localhost:18790). The rest
// of the app depends on the `TrueForgeClient` interface defined here.
//
// We support two modes:
//   - "fake"   (default in dev/CI/tests): a deterministic in-process adapter
//              that emits a fixed sequence of events. Day-one P7 constraint
//              tests (sandbox.created probe, delta coalescing, paused
//              terminal, role prefix) all run against this without needing
//              a live TrueForge server.
//   - "live"   (set TRUEFORGE_MODE=live and TRUEFORGE_BASE_URL=http://localhost:18790):
//              imports `@truefoundry/trueforge-sdk` lazily and forwards to
//              its `createTurnStream`. The package is not installed in this
//              dev env (we deferred the install — see PR description); the
//              import is gated so flipping TRUEFORGE_MODE=live without the
//              package gives a clean runtime error, not a build break.
//
// Why a fake: the TrueForge source isn't checked into this repo. The
// `docker-compose.trueforge.yml` bring-up requires a sibling `../trueforge`
// checkout (per the architecture doc). The P7 binding constraints govern
// how we stream events; the fake exercises them end-to-end today.

import type { LiveEvent } from "./event-reducer";

export type TrueForgeMode = "fake" | "live";

export type StartSessionInput = {
  paperId: string;
  mode: "learn" | "deep-read" | "review";
  source: string; // arXiv URL or "upload:<id>" or "fixture:<name>"
};

export type StartSessionResult = {
  sessionId: string;
  turnId: string;
};

export type TurnStream = {
  iterator: AsyncIterableIterator<LiveEvent>;
  cancel: () => void;
};

// Phase 4.1 — the resume-turn input item.
//
// Per the binding spec (docs/approval-gates.md), the resume turn on
// the same `threadId` carries a `user.tool_approval` input item and
// MUST NOT mix with `user.message`. We model that here as a tagged
// union so the type system enforces the rule at the call site.
export type ResumeInputItem =
  | {
      type: "user.tool_approval";
      threadId: string;
      toolCallId: string;
      approval: { status: "allow" } | { status: "deny"; reason: string };
    };

export type ResumeTurnInput = {
  sessionId: string;
  threadId: string;
  toolCallId: string;
  decision: "allow" | "deny";
  reason?: string;
};

export type ResumeTurnResult = {
  turnId: string;
};

export interface TrueForgeClient {
  startSession(input: StartSessionInput): Promise<StartSessionResult>;
  createTurnStream(sessionId: string, turnId: string): Promise<TurnStream>;
  resumeTurnWithApproval(input: ResumeTurnInput): Promise<ResumeTurnResult>;
  cancelSession(sessionId: string): Promise<void>;
}

function mode(): TrueForgeMode {
  const m = (process.env.TRUEFORGE_MODE ?? "fake").toLowerCase();
  return m === "live" ? "live" : "fake";
}

function baseUrl(): string {
  return process.env.TRUEFORGE_BASE_URL ?? "http://localhost:18790";
}

// ----------------------------------------------------------------------------
// Fake adapter — deterministic event sequence.
// ----------------------------------------------------------------------------
//
// Sequence (review mode, paperId=fixture):
//   1. turn.created
//   2. sandbox.created
//   3. model.message.delta x6 (reader, m1)
//   4. tool.response (parse, page 1 density 0.6)
//   5. tool.response (parse, page 2 density 0.8)
//   6. thread.created (searcher subagent)
//   7. tool.response (searcher, page 3 density 0.4)
//   8. thread.done (searcher)
//   9. tool.approval_required (verifier, bash)
//  10. turn.done with requiredActions (paused)  OR  plain turn.done
//
// The fake's sequence number is monotonic. The reducer's seq guard
// (which treats seq:0 as uncursorable) means tests that omit seq
// still work; live tests that pass real seq get the dedupe behavior.

// Event timestamps are relative to "now" so the audit page and Pulse
// show the run's real wall clock (a fixed 2026 fixture date made the
// audit Duration span from yesterday).
function fakeEventsFor(
  sessionId: string,
  turnId: string,
  uid: string,
  paused: boolean,
): LiveEvent[] {
  const base = Date.now();
  const at = (offsetMs: number) => new Date(base + offsetMs).toISOString();
  let seq = 0;
  const next = () => ++seq;
  const ev = (e: Omit<LiveEvent, "seq">): LiveEvent => ({ ...e, seq: next() });
  const events: LiveEvent[] = [
    ev({
      id: "e1", createdAt: at(0), type: "turn.created", payload: { sessionId, turnId },
    }),
    ev({
      id: "e2", createdAt: at(1_000), type: "sandbox.created",
      // Per-(session, turn) sandbox id: fresh per run (Daytona gives a
      // fresh sandbox per session), stable across stream reloads of
      // the SAME turn. `uid` derives from the unique session/turn ids.
      payload: { sandboxId: `sbx_${uid}` },
    }),
    ev({
      id: "e3a", createdAt: at(2_000), type: "model.message.delta",
      payload: { messageId: "m1", threadId: "thr_root", delta: "The Transformer is " },
    }),
    ev({
      id: "e3b", createdAt: at(2_100), type: "model.message.delta",
      payload: { messageId: "m1", threadId: "thr_root", delta: "a new simple network " },
    }),
    ev({
      id: "e3c", createdAt: at(2_200), type: "model.message.delta",
      payload: { messageId: "m1", threadId: "thr_root", delta: "based on attention." },
    }),
    ev({
      id: "e4", createdAt: at(3_000), type: "tool.response",
      payload: { toolName: "parse_pdf", threadId: "thr_root", page: 1, density: 0.6 },
    }),
    ev({
      id: "e5", createdAt: at(4_000), type: "tool.response",
      payload: { toolName: "parse_pdf", threadId: "thr_root", page: 2, density: 0.8 },
    }),
    ev({
      id: "e6", createdAt: at(5_000), type: "thread.created",
      payload: { threadId: "thr_searcher", title: "claims-section" },
    }),
    ev({
      id: "e7", createdAt: at(6_000), type: "tool.response",
      payload: { toolName: "exa_search", threadId: "thr_searcher", page: 3, density: 0.4 },
    }),
    ev({
      id: "e8", createdAt: at(7_000), type: "thread.done",
      payload: { threadId: "thr_searcher" },
    }),
  ];
  // The verifier thread/tool ids are ALSO per-(session, turn): a
  // replayed paper gets a new session/turn, so the gates table's
  // (thread_id, tool_call_id) unique key never swallows the new run's
  // gate insert.
  const verifierThreadId = `thr_verifier_${uid}`;
  const verifierToolCallId = `tc_${uid}`;
  if (paused) {
    events.push(
      ev({
        id: "e9", createdAt: "2026-08-27T14:00:08.000Z", type: "tool.approval_required",
        payload: {
          threadId: verifierThreadId,
          toolCallId: verifierToolCallId,
          toolName: "bash",
          // Qodo #10 — the upstream supplies the expected repo owner
          // for the identity confirm. The fake sets it to "tensorflow"
          // so the VerifyCard starts with Allow disabled (typed match
          // required) and TC-1 can type it in.
          repoOwner: "tensorflow",
        },
      }),
      ev({
        id: "e10", createdAt: at(9_000), type: "turn.done",
        payload: {
          state: "done",
          requiredActions: [{ type: "tool.approval", toolCallId: verifierToolCallId }],
          metrics: { totalTokens: 18402, totalCostInUsd: 0 },
        },
      }),
    );
  } else {
    events.push(
      ev({
        id: "e9", createdAt: at(8_000), type: "turn.done",
        payload: {
          state: "done",
          requiredActions: [],
          metrics: { totalTokens: 18402, totalCostInUsd: 0 },
        },
      }),
    );
  }
  return events;
}

// Qodo #5 — the post-resume event sequence. When the user Allows
// the verify gate, the TrueForge turn is resumed and the agent
// emits a small "continue" sequence (one model delta + a final
// turn.done) so the cockpit has something to stream on reload.
// For Deny, the agent emits a single "skipped" line + turn.done so
// the cockpit leaves the paused state cleanly.
function fakeResumeEventsFor(
  sessionId: string,
  decision: "allow" | "deny",
  threadId: string,
  toolCallId: string,
): LiveEvent[] {
  const turnId = `turn_resume_${Math.random().toString(36).slice(2, 8)}`;
  let seq = 0;
  const next = () => ++seq;
  const ev = (e: Omit<LiveEvent, "seq">): LiveEvent => ({ ...e, seq: next() });
  if (decision === "allow") {
    return [
      ev({
        id: "r1", createdAt: new Date().toISOString(), type: "turn.created",
        payload: { sessionId, turnId },
      }),
      ev({
        id: "r2", createdAt: new Date().toISOString(), type: "model.message.delta",
        payload: { messageId: "m2", threadId, delta: "Resumed after approval. Running tool…\n" },
      }),
      ev({
        id: "r3", createdAt: new Date().toISOString(), type: "turn.done",
        payload: { state: "done", requiredActions: [], metrics: { totalTokens: 19000, totalCostInUsd: 0 } },
      }),
    ];
  }
  // Deny / Expire — agent acknowledges the denial and closes the turn.
  return [
    ev({
      id: "r1", createdAt: new Date().toISOString(), type: "turn.created",
      payload: { sessionId, turnId },
    }),
    ev({
      id: "r2", createdAt: new Date().toISOString(), type: "model.message.delta",
      payload: { messageId: "m2", threadId, delta: `User ${decision} on tool call ${toolCallId}; continuing without running.\n` },
    }),
    ev({
      id: "r3", createdAt: new Date().toISOString(), type: "turn.done",
      payload: { state: "done", requiredActions: [], metrics: { totalTokens: 18500, totalCostInUsd: 0 } },
    }),
  ];
}

// Qodo #5 — the fake remembers the resume decision per (sessionId,
// toolCallId) so the next createTurnStream call for the resumed
// turnId emits the post-resume sequence (Qodo #5 — without this the
// fake loops back to the same paused sequence).
const resumeMemory: Map<string, { decision: "allow" | "deny"; events: LiveEvent[]; turnId: string }> = new Map();

class FakeTrueForgeClient implements TrueForgeClient {
  async startSession(input: StartSessionInput): Promise<StartSessionResult> {
    // The session id is unique per start (a random suffix): a replayed
    // paper gets a NEW session, which the per-(session, turn) uid in
    // createTurnStream turns into a fresh sandbox + fresh verifier ids.
    const sessionId = `sess_${input.paperId.slice(0, 8)}_${Math.random().toString(36).slice(2, 6)}`;
    const turnId = `turn_${Math.random().toString(36).slice(2, 8)}`;
    return { sessionId, turnId };
  }
  async createTurnStream(sessionId: string, turnId: string): Promise<TurnStream> {
    // If we have a resume stored for THIS turnId, emit the post-resume
    // sequence (Qodo #5). Otherwise emit the default paused sequence.
    const key = `${sessionId}:${turnId}`;
    const resume = resumeMemory.get(key);
    // Per-(session, turn) uid: STABLE across reloads of the same turn
    // (the cockpit re-opens the stream and must see the same sandbox /
    // verifier ids), UNIQUE across sessions and turns (a replay gets a
    // fresh sandbox and a fresh gate identity).
    const uid = `${sessionId.slice(-6)}_${turnId.slice(-6)}`;
    const events = resume
      ? resume.events
      : fakeEventsFor(sessionId, turnId, uid, true);
    let cancelled = false;
    const iterator: AsyncIterableIterator<LiveEvent> = {
      next: async () => {
        if (cancelled) return { value: undefined, done: true };
        const v = events.shift();
        if (!v) return { value: undefined, done: true };
        return { value: v, done: false };
      },
      return: async () => ({ value: undefined, done: true }),
      throw: async (e) => { throw e; },
      [Symbol.asyncIterator]: () => iterator,
    };
    return { iterator, cancel: () => { cancelled = true; } };
  }
  async cancelSession(_sessionId: string): Promise<void> {
    // no-op
  }
  async resumeTurnWithApproval(input: ResumeTurnInput): Promise<ResumeTurnResult> {
    const turnId = `turn_resume_${Math.random().toString(36).slice(2, 8)}`;
    const events = fakeResumeEventsFor(input.sessionId, input.decision, input.threadId, input.toolCallId);
    resumeMemory.set(`${input.sessionId}:${turnId}`, { decision: input.decision, events, turnId });
    return { turnId };
  }
}

// ----------------------------------------------------------------------------
// Live adapter — lazy import of the SDK. The package is NOT installed in
// this dev env; flipping TRUEFORGE_MODE=live without the package will throw
// a clean runtime error pointing to the install command.
// ----------------------------------------------------------------------------
class LiveTrueForgeClient implements TrueForgeClient {
  private sdk: any = null;
  private async client() {
    if (this.sdk) return this.sdk;
    let mod: any;
    try {
      // The SDK is intentionally NOT a dependency. Install with:
      //   npm install @truefoundry/trueforge-sdk
      // when wiring a real TrueForge server. Until then, live mode is
      // a one-line flip and the import error is the contract.
      //
      // The dynamic-import path is assembled at runtime via a string
      // variable so webpack does not try to resolve it at build time.
      const sdkName = "@truefoundry/trueforge-sdk";
      mod = await import(/* webpackIgnore: true */ sdkName);
    } catch (e) {
      throw new Error(
        "TRUEFORGE_MODE=live requires @truefoundry/trueforge-sdk. " +
        "Install with: npm install @truefoundry/trueforge-sdk",
      );
    }
    const Ctor = mod.TrueForgeClient ?? mod.default ?? mod;
    this.sdk = new Ctor({ baseUrl: baseUrl() });
    return this.sdk;
  }
  async startSession(input: StartSessionInput): Promise<StartSessionResult> {
    const c = await this.client();
    const session = await c.sessions.create({ metadata: { paperId: input.paperId, mode: input.mode } });
    const turn = await c.createTurn(session.id, { input: [{ type: "user.message", content: input.source }] });
    return { sessionId: session.id, turnId: turn.id };
  }
  async createTurnStream(sessionId: string, turnId: string): Promise<TurnStream> {
    const c = await this.client();
    const iter = await c.createTurnStream(sessionId, { turnId });
    return { iterator: iter, cancel: () => c.sessions.cancel(sessionId) };
  }
  async cancelSession(sessionId: string): Promise<void> {
    const c = await this.client();
    await c.sessions.cancel(sessionId);
  }
  async resumeTurnWithApproval(input: ResumeTurnInput): Promise<ResumeTurnResult> {
    const c = await this.client();
    // The resume contract: a NEW turn on the same `threadId` whose
    // input is a single `user.tool_approval` item. The live SDK call
    // is intentionally narrow — never mix in `user.message`.
    const item: ResumeInputItem = {
      type: "user.tool_approval",
      threadId: input.threadId,
      toolCallId: input.toolCallId,
      approval:
        input.decision === "allow"
          ? { status: "allow" }
          : { status: "deny", reason: input.reason ?? "" },
    };
    const turn = await c.createTurn(input.sessionId, { input: [item] });
    return { turnId: turn.id };
  }
}

let _client: TrueForgeClient | null = null;
export function getTrueForgeClient(): TrueForgeClient {
  if (_client) return _client;
  _client = mode() === "live" ? new LiveTrueForgeClient() : new FakeTrueForgeClient();
  return _client;
}

// Test-only hook: replace the client. Never call from production code.
export function __setTrueForgeClientForTest(c: TrueForgeClient | null): void {
  _client = c;
}
