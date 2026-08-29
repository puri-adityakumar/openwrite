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
//   - "live"   (set TRUEFORGE_MODE=live and TRUEFORGE_BASE_URL=http://localhost:8790):
//              talks HTTP directly to the TrueForge server (sessions +
//              turns + resumable SSE). No SDK package required.
//
// Why a fake: the TrueForge source isn't checked into this repo. The
// `docker-compose.trueforge.yml` bring-up requires a sibling `../trueforge`
// checkout (per the architecture doc). The P7 binding constraints govern
// how we stream events; the fake exercises them end-to-end today.

import type { LiveEvent } from "./event-reducer";
import { createParser, type EventSourceParser, type EventSourceMessage } from "eventsource-parser";

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

// Exported so tests can construct + inject a fake instance via
// __setTrueForgeClientForTest, keeping them independent of TRUEFORGE_MODE.
export class FakeTrueForgeClient implements TrueForgeClient {
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
// Live adapter — direct HTTP/SSE against the TrueForge server.
//
// Replaces the previous lazy-SDK stub (`LiveTrueForgeClient`, which
// required `@truefoundry/trueforge-sdk` — not installed in this dev env).
// The HTTP layer matches the TrueForge OpenAPI spec at /api/v1:
//   POST /api/v1/sessions
//   POST /api/v1/sessions/{id}/turns   (stream=false to kick off a run)
//   GET  /api/v1/sessions/{id}/turns/{tid}/subscribe   (resumable SSE)
//   POST /api/v1/sessions/{id}/cancel
//
// Default base URL is `http://localhost:8790` (the npx standalone
// harness); override with `TRUEFORGE_BASE_URL`.
// ----------------------------------------------------------------------------

// Wire-level shapes — kept loose because the upstream OpenAPI tags every
// event with a discriminator and we only consume a small subset.
type WireEvent = {
  type: string;
  id?: string;
  created_at?: string;
  thread_id?: string | null;
  turn_id?: string;
  sandbox_id?: string;
  title?: string;
  agent_info?: { type?: string; name?: string; input?: string; model?: string };
  parent?: { thread_id?: string; tool_call_id?: string };
  tool_call_id?: string;
  content?: string | null;
  tool_calls?: Array<{ id: string; source_event_id?: string }>;
  mcp_servers?: Array<{ id?: string; name?: string }>;
  state?: { status: string; required_actions?: unknown[]; metrics?: unknown };
  finish_reason?: string | null;
};

const AGENT_SPEC = {
  model: { name: "anthropic/gmi-minimax" },
  instructions:
    "You are the Openwrite research agent. Read the user's source, " +
    "stream your work as you go, and pause for human approval only when " +
    "a tool call is destructive or writes outside a sandbox.",
  config: { sandbox: { enabled: false } },
};

function jsonHeaders(extra?: Record<string, string>): Record<string, string> {
  return { "content-type": "application/json", accept: "application/json", ...(extra ?? {}) };
}

async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `TrueForge ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
    );
  }
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`TrueForge: invalid JSON response: ${(e as Error).message}`);
  }
}

// Heuristic for the tool name carried on tool.response events. The wire
// payload is freeform `content` (a string the agent chose to write); if
// it's JSON we look for `tool` / `name` / `function.name` keys, otherwise
// we fall back to the generic name.
function extractToolName(content: string | null | undefined): string {
  if (!content) return "tool";
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      const cand =
        (parsed as Record<string, unknown>).tool ??
        (parsed as Record<string, unknown>).name ??
        (parsed as Record<string, unknown>).toolName;
      if (typeof cand === "string" && cand.length > 0) return cand;
      const fn = (parsed as Record<string, unknown>).function;
      if (fn && typeof fn === "object") {
        const fnName = (fn as Record<string, unknown>).name;
        if (typeof fnName === "string" && fnName.length > 0) return fnName;
      }
    }
  } catch {
    // not JSON; fall through
  }
  return "tool";
}

class HttpTrueForgeClient implements TrueForgeClient {
  // startSession creates the session AND kicks off the initial turn
  // (stream=false so the call returns quickly). The returned turnId is
  // what `createTurnStream` subscribes to.
  async startSession(input: StartSessionInput): Promise<StartSessionResult> {
    const url = `${baseUrl()}/api/v1/sessions`;
    const sessionRes = await fetch(url, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ agent: { spec: AGENT_SPEC } }),
    });
    const sessionJson = await readJson<{ data?: { id?: string } }>(sessionRes);
    const sessionId = sessionJson.data?.id;
    if (!sessionId) {
      throw new Error("TrueForge: create session response missing data.id");
    }

    const turnRes = await fetch(`${baseUrl()}/api/v1/sessions/${sessionId}/turns`, {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        input: [{ type: "user.message", content: input.source }],
        previous_turn_id: "none",
        stream: false,
      }),
    });
    const turnJson = await readJson<{ data?: { id?: string } }>(turnRes);
    const turnId = turnJson.data?.id;
    if (!turnId) {
      throw new Error("TrueForge: create turn response missing data.id");
    }
    return { sessionId, turnId };
  }

  // createTurnStream opens the resumable SSE stream against the live
  // turn. We pull chunks off the fetch body and feed them into
  // `eventsource-parser`, translating each parsed JSON envelope into a
  // LiveEvent before yielding it to the caller. Cancellation aborts the
  // underlying fetch.
  async createTurnStream(sessionId: string, turnId: string): Promise<TurnStream> {
    const url =
      `${baseUrl()}/api/v1/sessions/${encodeURIComponent(sessionId)}` +
      `/turns/${encodeURIComponent(turnId)}/subscribe`;
    const controller = new AbortController();
    const queue: LiveEvent[] = [];
    let parser: EventSourceParser | null = null;
    let pumpError: Error | null = null;
    let pumpDone = false;
    type Waiter = (r: IteratorResult<LiveEvent>) => void;
    let waiter: Waiter | null = null;
    const flushWaiter = (r: IteratorResult<LiveEvent>) => {
      if (!waiter) return;
      const w = waiter;
      waiter = null;
      w(r);
    };

    const deliver = (ev: LiveEvent) => {
      if (waiter) {
        flushWaiter({ value: ev, done: false });
      } else {
        queue.push(ev);
      }
    };

    parser = createParser({
      onEvent: (msg: EventSourceMessage) => {
        if (!msg.data || msg.data === "[DONE]") return;
        const raw = msg.data;
        let parsed: WireEvent | null = null;
        try {
          parsed = JSON.parse(raw) as WireEvent;
        } catch (e) {
          console.error("[trueforge] SSE parse failed:", (e as Error).message, raw.slice(0, 200));
          return;
        }
        const translated = translateWireEvent(parsed, sessionId);
        if (translated) deliver(translated);
      },
      onError: (e) => {
        pumpError = e instanceof Error ? e : new Error(String(e));
      },
    });

    // The fetch + read loop runs in the background; cancellation aborts.
    (async () => {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: { accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => "");
          pumpError = new Error(
            `TrueForge subscribe ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`,
          );
          pumpDone = true;
          flushWaiter({ value: undefined, done: true });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) parser!.feed(decoder.decode(value, { stream: true }));
        }
      } catch (e) {
        // AbortError just means the caller cancelled — don't surface.
        if ((e as Error).name !== "AbortError") {
          pumpError = e instanceof Error ? e : new Error(String(e));
        }
      } finally {
        pumpDone = true;
        flushWaiter({ value: undefined, done: true });
      }
    })();

    const iterator: AsyncIterableIterator<LiveEvent> = {
      next: async () => {
        if (queue.length > 0) {
          return { value: queue.shift()!, done: false };
        }
        if (pumpError) throw pumpError;
        if (pumpDone) return { value: undefined, done: true };
        return new Promise((resolve) => {
          waiter = resolve;
        });
      },
      return: async () => {
        try { controller.abort(); } catch { /* noop */ }
        return { value: undefined, done: true };
      },
      throw: async (e) => { throw e; },
      [Symbol.asyncIterator]: () => iterator,
    };
    return {
      iterator,
      cancel: () => {
        try { controller.abort(); } catch { /* noop */ }
      },
    };
  }

  async cancelSession(sessionId: string): Promise<void> {
    const res = await fetch(
      `${baseUrl()}/api/v1/sessions/${encodeURIComponent(sessionId)}/cancel`,
      { method: "POST", headers: jsonHeaders() },
    );
    // 200 means the cancel was accepted; 404 means nothing was running.
    if (!res.ok && res.status !== 404) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `TrueForge cancel ${res.status} ${res.statusText}: ${text.slice(0, 500)}`,
      );
    }
  }

  async resumeTurnWithApproval(input: ResumeTurnInput): Promise<ResumeTurnResult> {
    const item: ResumeInputItem = {
      type: "user.tool_approval",
      threadId: input.threadId,
      toolCallId: input.toolCallId,
      approval:
        input.decision === "allow"
          ? { status: "allow" }
          : { status: "deny", reason: input.reason ?? "" },
    };
    const res = await fetch(
      `${baseUrl()}/api/v1/sessions/${encodeURIComponent(input.sessionId)}/turns`,
      {
        method: "POST",
        headers: jsonHeaders(),
        body: JSON.stringify({
          input: [item],
          previous_turn_id: "auto",
          stream: false,
        }),
      },
    );
    const json = await readJson<{ data?: { id?: string } }>(res);
    const turnId = json.data?.id;
    if (!turnId) {
      throw new Error("TrueForge: resume turn response missing data.id");
    }
    return { turnId };
  }
}

// Monotonic counter shared by all streams created by this adapter; the
// reducer dedupes by `seq` so each event gets a fresh, increasing number.
let _seqCounter = 0;
const nextSeq = () => ++_seqCounter;

// Translate a single wire event into the in-repo LiveEvent shape. Returns
// null for events we don't care about (e.g. tool_calls-only deltas — text
// already streamed via content chunks).
function translateWireEvent(
  ev: WireEvent,
  fallbackSessionId: string,
): LiveEvent | null {
  const base = {
    id: ev.id ?? `ev_${nextSeq()}`,
    seq: nextSeq(),
    createdAt: ev.created_at ?? new Date().toISOString(),
  };
  switch (ev.type) {
    case "turn.created": {
      return {
        ...base,
        type: "turn.created",
        payload: { sessionId: fallbackSessionId, turnId: ev.turn_id ?? "" },
      };
    }
    case "turn.done": {
      const state = ev.state ?? { status: "done" };
      return {
        ...base,
        type: "turn.done",
        payload: {
          state: state.status,
          requiredActions: state.required_actions ?? [],
          metrics: state.metrics ?? { totalTokens: 0, totalCostInUsd: 0 },
        },
      };
    }
    case "model.message.delta": {
      // Skip non-text chunks (tool-call deltas, refusal-only deltas).
      const text = typeof ev.content === "string" ? ev.content : null;
      if (text === null) return null;
      return {
        ...base,
        type: "model.message.delta",
        payload: {
          messageId: ev.id ?? `msg_${base.seq}`,
          threadId: ev.thread_id ?? "",
          delta: text,
        },
      };
    }
    case "tool.response": {
      return {
        ...base,
        type: "tool.response",
        payload: {
          threadId: ev.thread_id ?? "",
          toolName: extractToolName(ev.content),
          toolCallId: ev.tool_call_id ?? "",
        },
      };
    }
    case "tool.approval_required": {
      const first = (ev.tool_calls ?? [])[0];
      return {
        ...base,
        type: "tool.approval_required",
        // The reducer (and the stream route at lines 220-258) accept
        // either a flat shape or a nested `toolCalls[*]` shape; we send
        // BOTH so the audit row gets populated regardless.
        payload: {
          threadId: ev.thread_id ?? "",
          toolCallId: first?.id ?? "",
          toolName: "tool",
          toolCalls: ev.tool_calls ?? [],
        },
      };
    }
    case "thread.created": {
      return {
        ...base,
        type: "thread.created",
        payload: {
          threadId: ev.thread_id ?? "",
          title: ev.title ?? "",
          agentInfo: ev.agent_info,
          parent: ev.parent,
        },
      };
    }
    case "thread.done": {
      return {
        ...base,
        type: "thread.done",
        payload: { threadId: ev.thread_id ?? "" },
      };
    }
    case "sandbox.created": {
      return {
        ...base,
        type: "sandbox.created",
        payload: { sandboxId: ev.sandbox_id ?? "" },
      };
    }
    case "mcp.initialize": {
      const first = (ev.mcp_servers ?? [])[0];
      return {
        ...base,
        type: "mcp.initialize",
        payload: { server: first?.name ?? "mcp" },
      };
    }
    default:
      return null;
  }
}

let _client: TrueForgeClient | null = null;
export function getTrueForgeClient(): TrueForgeClient {
  if (_client) return _client;
  _client = mode() === "live" ? new HttpTrueForgeClient() : new FakeTrueForgeClient();
  return _client;
}

// Test-only hook: replace the client. Never call from production code.
export function __setTrueForgeClientForTest(c: TrueForgeClient | null): void {
  _client = c;
}
