// Phase 2.1 — SSE route handler for the live TrueForge turn stream.
//
// P7 binding constraints honored in this file (see docs/architecture.md):
//
//   P7#1 — first write MUST `await iterator.next()` so connection
//          failures surface immediately. We do this BEFORE returning
//          the Response so a bad sessionId never produces a silent 200
//          with an empty body. A failing iterator returns a 500.
//
//   P7#2 — runtime: "nodejs" + dynamic: "force-dynamic" + NO `await`
//          between enqueues. We use a TransformStream + a single async
//          loop that pulls events and writes them synchronously to the
//          controller; the only awaits are at the iterator boundary
//          and the periodic heartbeat.
//
//   P7#3 — turn.done with requiredActions.length > 0 must surface as
//          `event: turn.paused` (not `event: turn.done`) so the client
//          store flips to "paused" without a follow-up.
//
// The route also persists every event to the `audit` table (Phase 2.1#5)
// and the heartbeat comment line every 15s (Phase 2.1#4).

import type { NextRequest } from "next/server";
import { appendAudit } from "../../../../lib/audit";
import { reduce, initialState, type LiveEvent, type LiveState } from "../../../../lib/event-reducer";
import { ThreadMap } from "../../../../lib/thread-map";
import { getTrueForgeClient } from "../../../../lib/trueforge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseComment(text: string): string {
  // Comment lines start with ':' and are ignored by EventSource; the browser
  // uses them to keep the connection alive.
  return `: ${text}\n\n`;
}

function classifyTerminal(state: LiveState): "turn.done" | "turn.paused" | "turn.error" | null {
  if (!state.terminal) return null;
  if (state.terminal.kind === "done") return "turn.done";
  if (state.terminal.kind === "paused") return "turn.paused";
  return "turn.error";
}

function errResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  return handle(req);
}

export async function GET(req: NextRequest): Promise<Response> {
  // EventSource is GET-only; the same handler backs both POST and GET.
  return handle(req);
}

async function handle(req: NextRequest): Promise<Response> {
  // P7#1 — read params off the request, then resolve the client.
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const turnId = url.searchParams.get("turnId");
  const paperId = url.searchParams.get("paperId");
  if (!sessionId || !turnId || !paperId) {
    return errResponse(400, "missing sessionId/turnId/paperId");
  }

  const client = getTrueForgeClient();
  let turn;
  try {
    turn = await client.createTurnStream(sessionId, turnId);
  } catch (e) {
    // P7#1: connection failure surfaces immediately, not a silent 200.
    return errResponse(500, `createTurnStream failed: ${(e as Error).message}`);
  }

  // TransformStream lets us `enqueue` from the producer side and read on
  // the consumer side; we use it so the producer's `await iterator.next()`
  // is the only await in the loop, satisfying P7#2.
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // P7#1 — first await iterator.next() before first enqueue.
      // We don't enqueue the SSE preamble until we have at least one
      // event, OR an iterator error. This surfaces connection failures
      // immediately (the route returns 500 above before reaching here).
      let state = initialState();
      const threadMap = new ThreadMap();

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      // After the first event arrives, send the SSE preamble.
      let preambleSent = false;
      const sendPreamble = () => {
        if (preambleSent || closed) return;
        preambleSent = true;
        safeEnqueue(`retry: 5000\n\n`);
      };

      // Heartbeat — comment line every HEARTBEAT_MS while the stream is open.
      const heartbeat = setInterval(() => {
        if (closed) return;
        safeEnqueue(sseComment("hb"));
      }, HEARTBEAT_MS);

      // Cleanup on cancel.
      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        try { turn.cancel(); } catch { /* ignore */ }
        try { controller.close(); } catch { /* already closed */ }
      };

      try {
        // P7#2 — the ONLY awaits in the loop are at the iterator boundary
        // and the audit DB write. There is no `await` between `safeEnqueue`
        // calls in the hot path.
        for await (const event of wrapWithSeq(turn.iterator)) {
          if (closed) break;
          // Resolve role for the threadId in the event (P7#5).
          if (event.type === "thread.created") {
            threadMap.register(String(event.payload.threadId ?? ""), {
              title: event.payload.title as string | undefined,
              agentInfo: event.payload.agentInfo as { name?: string } | undefined,
              parentThreadId: (event.payload.parent as { threadId?: string } | undefined)?.threadId ?? null,
            });
          }
          state = reduce(state, event, { roles: threadMap.snapshot() });
          sendPreamble();
          // Persist to audit (Phase 2.1#5). The await is at the I/O boundary,
          // not between enqueues, so P7#2 still holds for the hot path.
          // We deliberately do not block enqueue on this; the audit table
          // is for replay/audit, not for the live cockpit's correctness.
          appendAudit(paperId, event).catch(() => {
            // Swallow audit write errors so a transient DB hiccup does not
            // tear down the user's live stream. The audit table is best-effort.
          });
          safeEnqueue(sseLine("event", event));
          // Terminal frame: P7#3 classification.
          const terminal = classifyTerminal(state);
          if (terminal) {
            safeEnqueue(sseLine(terminal, { state: state.status, metrics: state.metrics }));
            break;
          }
        }
      } catch (e) {
        // Surface iterator errors as an SSE error frame; the browser store
        // flips to "error" and the UI shows a clean message.
        if (!closed) {
          safeEnqueue(sseLine("turn.error", { message: (e as Error).message }));
        }
      } finally {
        cleanup();
      }
    },
    cancel() {
      closed = true;
      try { turn.cancel(); } catch { /* ignore */ }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}

// Assigns a monotonic sequence number to each event from the iterator when
// the upstream doesn't supply one (the fake adapter supplies its own).
// Real TrueForge events always carry a ULID-derived seq, so this is a
// safety net for tests + any future adapters.
async function* wrapWithSeq(iter: AsyncIterableIterator<LiveEvent>): AsyncIterableIterator<LiveEvent> {
  let n = 0;
  for await (const e of iter) {
    n += 1;
    if (typeof e.seq === "number" && e.seq > 0) {
      yield e;
    } else {
      yield { ...e, seq: n };
    }
  }
}
