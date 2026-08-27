// Phase 2.1 — TrueForge adapter boundary.
//
// This is the ONLY file in the Recap app that talks to the TrueForge
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

export interface TrueForgeClient {
  startSession(input: StartSessionInput): Promise<StartSessionResult>;
  createTurnStream(sessionId: string, turnId: string): Promise<TurnStream>;
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

function fakeEventsFor(input: StartSessionInput, paused: boolean): LiveEvent[] {
  const sessionId = `sess_${input.paperId.slice(0, 8)}`;
  const turnId = `turn_${Math.random().toString(36).slice(2, 8)}`;
  const base = `2026-08-27T14:00:00.000Z`;
  let seq = 0;
  const next = () => ++seq;
  const ev = (e: Omit<LiveEvent, "seq">): LiveEvent => ({ ...e, seq: next() });
  const events: LiveEvent[] = [
    ev({
      id: "e1", createdAt: base, type: "turn.created", payload: { sessionId, turnId },
    }),
    ev({
      id: "e2", createdAt: "2026-08-27T14:00:01.000Z", type: "sandbox.created",
      payload: { sandboxId: `sbx_${input.paperId.slice(0, 6)}` },
    }),
    ev({
      id: "e3a", createdAt: "2026-08-27T14:00:02.000Z", type: "model.message.delta",
      payload: { messageId: "m1", threadId: "thr_root", delta: "The Transformer is " },
    }),
    ev({
      id: "e3b", createdAt: "2026-08-27T14:00:02.100Z", type: "model.message.delta",
      payload: { messageId: "m1", threadId: "thr_root", delta: "a new simple network " },
    }),
    ev({
      id: "e3c", createdAt: "2026-08-27T14:00:02.200Z", type: "model.message.delta",
      payload: { messageId: "m1", threadId: "thr_root", delta: "based on attention." },
    }),
    ev({
      id: "e4", createdAt: "2026-08-27T14:00:03.000Z", type: "tool.response",
      payload: { toolName: "parse_pdf", threadId: "thr_root", page: 1, density: 0.6 },
    }),
    ev({
      id: "e5", createdAt: "2026-08-27T14:00:04.000Z", type: "tool.response",
      payload: { toolName: "parse_pdf", threadId: "thr_root", page: 2, density: 0.8 },
    }),
    ev({
      id: "e6", createdAt: "2026-08-27T14:00:05.000Z", type: "thread.created",
      payload: { threadId: "thr_searcher", title: "claims-section" },
    }),
    ev({
      id: "e7", createdAt: "2026-08-27T14:00:06.000Z", type: "tool.response",
      payload: { toolName: "exa_search", threadId: "thr_searcher", page: 3, density: 0.4 },
    }),
    ev({
      id: "e8", createdAt: "2026-08-27T14:00:07.000Z", type: "thread.done",
      payload: { threadId: "thr_searcher" },
    }),
  ];
  if (paused) {
    events.push(
      ev({
        id: "e9", createdAt: "2026-08-27T14:00:08.000Z", type: "tool.approval_required",
        payload: { threadId: "thr_verifier", toolCallId: "tc_1", toolName: "bash" },
      }),
      ev({
        id: "e10", createdAt: "2026-08-27T14:00:09.000Z", type: "turn.done",
        payload: {
          state: "done",
          requiredActions: [{ type: "tool.approval", toolCallId: "tc_1" }],
          metrics: { totalTokens: 18402, totalCostInUsd: 0 },
        },
      }),
    );
  } else {
    events.push(
      ev({
        id: "e9", createdAt: "2026-08-27T14:00:08.000Z", type: "turn.done",
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

class FakeTrueForgeClient implements TrueForgeClient {
  async startSession(input: StartSessionInput): Promise<StartSessionResult> {
    const sessionId = `sess_${input.paperId.slice(0, 8)}`;
    const turnId = `turn_${Math.random().toString(36).slice(2, 8)}`;
    return { sessionId, turnId };
  }
  async createTurnStream(_sessionId: string, _turnId: string): Promise<TurnStream> {
    // Use paused=true by default; tests that want the done terminal can
    // override via the live path or by re-implementing this method.
    const input: StartSessionInput = {
      paperId: "00000000-0000-0000-0000-000000000000",
      mode: "review",
      source: "fixture:demo",
    };
    const events = fakeEventsFor(input, true);
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
