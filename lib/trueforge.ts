// Phase 2.1 — TrueForge adapter (live-only).
//
// This is the ONLY file that talks to the TrueForge server (the harness
// that runs at TRUEFORGE_BASE_URL, default http://localhost:18790 for
// `docker compose up`; standalone `npx` defaults to 8790). The rest
// of the app depends on the `TrueForgeClient` interface defined here — no
// in-process fake, no deterministic double.
//
// Previous fake adapter (TRUEFORGE_MODE=fake) removed: every session now
// requires a real TrueForge server. Tests inject a double via
// `__setTrueForgeClientForTest` instead of relying on a built-in Fake.

import type { LiveEvent } from "./event-reducer";
import { createParser, type EventSourceParser, type EventSourceMessage } from "eventsource-parser";

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

function baseUrl(): string {
  // Canonical host port for `docker compose up` is 18790 (see
  // docker-compose.override.yml + docs/architecture.md). Standalone
  // `npx @truefoundry/trueforge` defaults to 8790 — set
  // TRUEFORGE_BASE_URL=http://localhost:8790 when using that path.
  // TF_BASE_URL is a legacy alias kept for backwards compat.
  return (
    process.env.TRUEFORGE_BASE_URL ??
    process.env.TF_BASE_URL ??
    "http://localhost:18790"
  );
}

// ----------------------------------------------------------------------------
// Live adapter — direct HTTP/SSE against the TrueForge server.
//
// Matches the TrueForge OpenAPI spec at /api/v1:
//   POST /api/v1/sessions
//   POST /api/v1/sessions/{id}/turns   (stream=false to kick off a run)
//   GET  /api/v1/sessions/{id}/turns/{tid}/subscribe   (resumable SSE)
//   POST /api/v1/sessions/{id}/cancel
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
      { method: "POST", headers: jsonHeaders(), body: JSON.stringify({}) },
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
    // Wire shape per OpenAPI UserToolApprovalEvent: snake_case thread_id / tool_call_id
    const item = {
      type: "user.tool_approval" as const,
      thread_id: input.threadId,
      tool_call_id: input.toolCallId,
      approval:
        input.decision === "allow"
          ? { status: "allow" as const }
          : { status: "deny" as const, reason: input.reason ?? "" },
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
      // Normalize nested required_actions: accept snake_case/camelCase for
      // threadId and toolCalls[*].id so downstream (stream route + reducer)
      // sees a consistent shape regardless of wire casing.
      const rawActions = (state.required_actions as unknown[] | undefined) ?? [];
      const requiredActions = rawActions.map((a) => {
        if (!a || typeof a !== "object") return a;
        const act = a as Record<string, unknown>;
        const tcsRaw = Array.isArray(act.toolCalls)
          ? act.toolCalls
          : Array.isArray(act.tool_calls)
            ? act.tool_calls
            : null;
        if (tcsRaw === null) return act;
        const tcs = (tcsRaw as Array<Record<string, unknown>>).map((tc) => {
          if (!tc || typeof tc !== "object") return tc;
          const id = (tc.id ?? tc.toolCallId ?? (tc as Record<string, unknown>).tool_call_id ?? "") as string;
          const name = (tc.name ?? tc.toolName ?? (tc as Record<string, unknown>).tool_name ?? "tool") as string;
          return { ...tc, id, toolCallId: id, tool_call_id: id, name, toolName: name, tool_name: name };
        });
        const threadId = (act.threadId ?? act.thread_id ?? "") as string;
        return { ...act, threadId, thread_id: threadId, toolCalls: tcs, tool_calls: tcs };
      });
      return {
        ...base,
        type: "turn.done",
        payload: {
          state: state.status,
          requiredActions,
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
  _client = new HttpTrueForgeClient();
  return _client;
}

// Test-only hook: replace the client. Never call from production code.
export function __setTrueForgeClientForTest(c: TrueForgeClient | null): void {
  _client = c;
}
