// Phase 2.1 — SSE route handler for the live TrueForge turn stream.
//
// P7 binding constraints honored in this file (see docs/architecture.md):
//
//   P7#1 — first HTTP response MUST reflect the first iterator result.
//          A failing first pull returns 500 immediately; we never return
//          a 200 with an empty/error-only body. Implemented with a
//          "first event" peek before the Response is constructed.
//
//   P7#2 — runtime: "nodejs" + dynamic: "force-dynamic" + NO `await`
//          between enqueues. We use a ReadableStream + a single async
//          loop that pulls events and writes them synchronously to the
//          controller; the only awaits in the hot path are at the
//          iterator boundary and the audit DB write (off the enqueue
//          critical path).
//
//   P7#3 — turn.done with requiredActions.length > 0 must surface as
//          `event: turn.paused` (not `event: turn.done`) so the client
//          store flips to "paused" without a follow-up.
//
//   P7#4 — the 15s heartbeat is a comment line so the EventSource
//          auto-reconnects cleanly if the connection drops.
//
//   P7#5 — threadId→role is resolved server-side via ThreadMap so the
//          reducer never inspects event text for roles. The resolved
//          roles are mirrored into the SSE frames (see #7) so the
//          client store can apply them too.
//
// The route also persists every event to the `audit` table (Phase 2.1#5).

import type { NextRequest } from "next/server";
import { appendAudit, appendAuditEvent, AuditWriteError } from "../../../../lib/audit";
import { reduce, initialState, type LiveEvent, type LiveState } from "../../../../lib/event-reducer";
import { ThreadMap } from "../../../../lib/thread-map";
import { getTrueForgeClient } from "../../../../lib/trueforge";
import { insertGate } from "../../../../lib/gates";
import { enforceCap } from "../../../../lib/cap-server";
import { registerActiveStream, unregisterActiveStream } from "../../../../lib/stream-registry";
import { query } from "../../../../lib/db";
import { requireUser } from "../../../../lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 15_000;

function sseLine(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseComment(text: string): string {
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
  // P7#1 — read params, then authenticate + authorize the caller.
  // The stream route MUST verify that the paper belongs to the current
  // user and that the supplied sessionId/turnId match the paper row —
  // otherwise any caller with valid identifiers could consume another
  // user's run. (Qodo #4)
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const turnId = url.searchParams.get("turnId");
  const paperId = url.searchParams.get("paperId");
  if (!sessionId || !turnId || !paperId) {
    return errResponse(400, "missing sessionId/turnId/paperId");
  }

  let user;
  try {
    user = await requireUser();
  } catch {
    return errResponse(401, "authentication required");
  }

  // Ownership + session/turn match.
  const owner = await query<{ session_id: string | null; turn_id: string | null; halted: boolean }>(
    `SELECT session_id, turn_id, halted FROM papers WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [paperId, user.sub],
  );
  if (owner.rows.length === 0) return errResponse(404, "paper not found");
  // Phase 5.1 — a halted run is locked: no stream resurrection.
  if (owner.rows[0]!.halted) return errResponse(409, "run is halted (locked)");
  if (owner.rows[0]!.session_id !== sessionId || owner.rows[0]!.turn_id !== turnId) {
    return errResponse(403, "session/turn does not match paper");
  }

  return buildStream({ sessionId, turnId, paperId });
}

// Pure stream builder — separated from the auth wrapper so unit tests
// can exercise the P7 pipeline without standing up a session cookie.
export async function buildStream(input: {
  sessionId: string;
  turnId: string;
  paperId: string;
}): Promise<Response> {
  const { sessionId, turnId, paperId } = input;
  const client = getTrueForgeClient();
  let turn;
  try {
    turn = await client.createTurnStream(sessionId, turnId);
  } catch (e) {
    return errResponse(500, `createTurnStream failed: ${(e as Error).message}`);
  }

  // P7#1 — first `iterator.next()` is awaited BEFORE the Response is
  // constructed. If it throws, we return 500. If the iterator is empty
  // on the first pull (done: true), we return 204 — there is nothing to
  // stream. (Qodo #1)
  let firstResult: IteratorResult<LiveEvent>;
  try {
    firstResult = await turn.iterator.next();
  } catch (e) {
    return errResponse(500, `first event read failed: ${(e as Error).message}`);
  }
  if (firstResult.done) {
    try { turn.cancel(); } catch { /* ignore */ }
    return new Response(null, { status: 204 });
  }

  // P7#2 — ReadableStream + single async loop; only awaits are at the
  // iterator boundary and audit DB. The first event is yielded by
  // prepending it to the loop.
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  // Qodo review round 2 — the halt route's Pause must suspend the
  // live stream for real: this hook is registered in the active-stream
  // registry so POST /api/agent/halt (action=pause) can tear the
  // stream down mid-flight. Declared here so both `start` and
  // `cancel` share it.
  const streamCancelHook = () => {
    closed = true;
    try { turn.cancel(); } catch { /* ignore */ }
  };
  registerActiveStream(paperId, streamCancelHook);
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
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

      let preambleSent = false;
      const sendPreamble = () => {
        if (preambleSent || closed) return;
        preambleSent = true;
        safeEnqueue(`retry: 5000\n\n`);
      };

      const startHeartbeat = () => {
        if (heartbeat || closed) return;
        heartbeat = setInterval(() => {
          if (closed) return;
          safeEnqueue(sseComment("hb"));
        }, HEARTBEAT_MS);
      };

      const cleanup = () => {
        unregisterActiveStream(paperId, streamCancelHook);
        if (closed) {
          if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
          return;
        }
        closed = true;
        if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
        try { turn.cancel(); } catch { /* ignore */ }
        try { controller.close(); } catch { /* already closed */ }
      };

      const processEvent = async (event: LiveEvent) => {
        if (event.type === "thread.created") {
          threadMap.register(String(event.payload.threadId ?? ""), {
            title: event.payload.title as string | undefined,
            agentInfo: event.payload.agentInfo as { name?: string } | undefined,
            parentThreadId: (event.payload.parent as { threadId?: string } | undefined)?.threadId ?? null,
          });
        }
        // Phase 4.1: on every tool.approval_required, persist a `gates`
        // row keyed by (threadId, toolCallId). The unique key makes the
        // insert idempotent, so duplicate upstream events don't blow up.
        // The reducer has already pushed the gate into state.gates by
        // the time we get here; the DB row is the durable mirror.
        //
        // Qodo #6 — the documented TrueForge event shape nests the
        // toolCallId under `toolCalls[*]`. Accept flat, camelCase,
        // and snake_case shapes for compatibility.
        if (event.type === "tool.approval_required") {
          const flat = event.payload as Record<string, unknown>;
          const toolCalls = Array.isArray(flat.toolCalls)
            ? (flat.toolCalls as Array<Record<string, unknown>>)
            : Array.isArray((flat as Record<string, unknown>).tool_calls)
              ? ((flat as Record<string, unknown>).tool_calls as Array<Record<string, unknown>>)
              : [];
          const first = toolCalls[0] ?? {};
          const toolCallId = String(
            flat.toolCallId ??
              (flat as Record<string, unknown>).tool_call_id ??
              first.id ??
              first.toolCallId ??
              (first as Record<string, unknown>).tool_call_id ??
              "",
          );
          const toolName = String(
            flat.toolName ??
              (flat as Record<string, unknown>).tool_name ??
              first.name ??
              first.toolName ??
              (first as Record<string, unknown>).tool_name ??
              "tool",
          );
          const threadId = String(flat.threadId ?? (flat as Record<string, unknown>).thread_id ?? "");
          // Qodo review #6 — an approval event with NO extractable
          // thread-id / tool-call id can never be approved (the resume
          // contract requires both — TrueForge rejects with 400
          // `expected string, received undefined` for either empty).
          // Skip the insert; the event still flows to the audit + cockpit.
          if (!threadId || !toolCallId) {
            console.error(
              `[stream] tool.approval_required without threadId/toolCallId — skipping gate insert (threadId=${threadId ? "ok" : "empty"} toolCallId=${toolCallId ? "ok" : "empty"})`,
            );
          } else {
            try {
              await insertGate({
                paperId,
                threadId,
                toolCallId,
                toolName,
                // Qodo #7 — the kind/severity are not in the wire event.
                // The default is a verify gate (the only one we ship
                // today). The live adapter can override by setting
                // `gateKind` / `gateSeverity` in the payload (this is
                // an internal extension, not on the TrueForge wire).
                kind: (typeof flat.gateKind === "string"
                  ? flat.gateKind
                  : "verify") as "verify" | "publish" | "save",
                severity: (typeof flat.gateSeverity === "string"
                  ? flat.gateSeverity
                  : "irreversible") as "reversible" | "irreversible",
                payload: event.payload as Record<string, unknown>,
              });
            } catch (e) {
              // Qodo #8 — gate persistence failure must not be silent.
              // Log the failure and flip the paper to 'error' so the
              // cockpit renders a "gate unavailable" badge and the
              // user is not stranded on a paused run with no Allow/Deny
              // path. The audit table still records the upstream event
              // below; this just surfaces the persistence-layer problem.
              console.error("[stream] insertGate failed:", (e as Error).message);
              try {
                await query(
                  `UPDATE papers SET status = 'error', updated_at = now() WHERE id = $1`,
                  [paperId],
                );
              } catch (e2) {
                console.error("[stream] papers.status=error update failed:", (e2 as Error).message);
              }
            }
          }
        }
        // Qodo #2 — stranded paused: if turn.done carries requiredActions
        // but every entry lacks threadId/toolCallId, persisting no gate and
        // then marking paused leaves the run permanently stuck with no
        // Allow/Deny path. Detect the stranded case BEFORE the reducer sees
        // the event. Keep the original event immutable for audit (so the
        // malformed action stays in the durable trail), and feed a cloned
        // filtered payload to the reducer/gate loop so it cannot pause on
        // unpersistable gates. Surface a recoverable turn.error instead.
        let turnDoneStranded = false;
        let turnDoneFiltered: Array<Record<string, unknown>> | null = null;
        let eventForReduce: LiveEvent = event;
        if (event.type === "turn.done") {
          const raw = (event.payload.requiredActions as Array<Record<string, unknown>> | undefined) ?? [];
          if (raw.length > 0) {
            const filtered = raw.filter((act) => {
              if (act?.type !== "tool.approval_required" && act?.type !== "tool.response_required") return true;
              const tid = String((act as Record<string, unknown>).threadId ?? (act as Record<string, unknown>).thread_id ?? "");
              const tcs = (Array.isArray((act as Record<string, unknown>).toolCalls)
                ? (act as Record<string, unknown>).toolCalls
                : Array.isArray((act as Record<string, unknown>).tool_calls)
                  ? (act as Record<string, unknown>).tool_calls
                  : []) as Array<Record<string, unknown>>;
              const first = tcs[0] ?? {};
              const tcid = String(
                first.id ??
                  first.toolCallId ??
                  (first as Record<string, unknown>).tool_call_id ??
                  "",
              );
              return Boolean(tid && tcid);
            });
            const rawGateCount = raw.filter(
              (a) => a?.type === "tool.approval_required" || a?.type === "tool.response_required",
            ).length;
            const filteredGateCount = filtered.filter(
              (a) => a?.type === "tool.approval_required" || a?.type === "tool.response_required",
            ).length;
            if (rawGateCount > 0 && filteredGateCount === 0) {
              turnDoneStranded = true;
              turnDoneFiltered = filtered;
            } else if (filtered.length !== raw.length) {
              turnDoneFiltered = filtered;
              for (const act of raw) {
                if (!filtered.includes(act)) {
                  const tid = String((act as Record<string, unknown>).threadId ?? (act as Record<string, unknown>).thread_id ?? "");
                  const tcs = (Array.isArray((act as Record<string, unknown>).toolCalls)
                    ? (act as Record<string, unknown>).toolCalls
                    : Array.isArray((act as Record<string, unknown>).tool_calls)
                      ? (act as Record<string, unknown>).tool_calls
                      : []) as Array<Record<string, unknown>>;
                  const first = tcs[0] ?? {};
                  const tcid = String(
                    first.id ??
                      first.toolCallId ??
                      (first as Record<string, unknown>).tool_call_id ??
                      "",
                  );
                  console.error(
                    `[stream] requiredAction missing threadId/toolCallId — filtered before reduce (threadId=${tid ? "ok" : "empty"} toolCallId=${tcid ? "ok" : "empty"} type=${act?.type})`,
                  );
                }
              }
            }
            if (turnDoneFiltered !== null) {
              // Clone for reducer/gate loop; keep original `event` for audit.
              eventForReduce = {
                ...event,
                payload: { ...event.payload, requiredActions: turnDoneFiltered },
              } as LiveEvent;
            }
          }
        }

        const roles = threadMap.snapshot();
        const next = reduce(state, eventForReduce, { roles });
        state = next;
        const eventWithRoles: LiveEvent & { _roles?: Record<string, string> } = {
          ...eventForReduce,
          _roles: Object.fromEntries(roles),
        };
        try {
          // Audit the ORIGINAL wire event so malformed requiredActions remain
          // reconstructible after logs expire (Qodo observability).
          await appendAudit(paperId, event);
        } catch (e) {
          if (e instanceof AuditWriteError) {
            safeEnqueue(sseLine("turn.error", {
              message: "audit write failed",
              detail: e.message,
            }));
            return { terminal: true, next };
          }
          throw e;
        }
        sendPreamble();
        startHeartbeat();
        safeEnqueue(sseLine("event", eventWithRoles));
        // Stranded gate: surface as turn.error but honor cap hard-stop first.
        // The cap check uses terminal metrics; a cap-exceeded paper must be
        // locked with halt_reason='cap' not overwritten as plain error.
        if (turnDoneStranded) {
          const m = (event.payload.metrics as { totalTokens?: number; totalCostInUsd?: number } | undefined) ?? {};
          try {
            const stopped = await enforceCap(paperId, {
              totalTokens: m.totalTokens ?? 0,
              totalCostInUsd: m.totalCostInUsd ?? 0,
            });
            if (stopped) {
              safeEnqueue(sseLine("cap.exceeded", { totalTokens: m.totalTokens ?? 0 }));
              safeEnqueue(sseLine("turn.error", { message: "cap exceeded", state: "error" }));
              return { terminal: true, next };
            }
          } catch (e) {
            // enforceCap is two-phase: it can throw AFTER the cap lock (UPDATE
            // papers halted=true) but before the cap.exceeded audit, or BEFORE
            // the lock due to a DB error. Re-read the paper to disambiguate.
            console.error("[stream] stranded cap check failed:", (e as Error).message);
            try {
              const st = await query<{
                halted: boolean;
                halt_reason: string | null;
                cap_usd: string | number | null;
                cap_tokens: number | null;
              }>(
                `SELECT halted, halt_reason, cap_usd, cap_tokens FROM papers WHERE id = $1 LIMIT 1`,
                [paperId],
              );
              const row = st.rows[0];
              if (row?.halted && row.halt_reason === "cap") {
                // Lock committed but audit may have failed — retry the cap audit
                // idempotently and with full limit context (Qodo: Cap audit never
                // retried + Cap retry loses limit context + can duplicate audits).
                try {
                  // Idempotency: only skip retry if THIS cap (same totalTokens)
                  // was already audited. A prior cap from an earlier run/replay
                  // with different usage must not suppress the current retry
                  // (Qodo: Old cap audit suppresses retry).
                  const exists = await query(
                    `SELECT 1 FROM audit WHERE paper_id = $1 AND events->>'type' = 'cap.exceeded' AND (events->'payload'->>'totalTokens')::int = $2 LIMIT 1`,
                    [paperId, m.totalTokens ?? 0],
                  );
                  if (exists.rows.length === 0) {
                    await appendAuditEvent(paperId, {
                      type: "cap.exceeded",
                      payload: {
                        totalTokens: m.totalTokens ?? 0,
                        totalCostInUsd: m.totalCostInUsd ?? 0,
                        capTokens: row.cap_tokens,
                        capUsd: row.cap_usd == null ? null : Number(row.cap_usd),
                      },
                    });
                  } else {
                    console.log("[stream] cap audit already present for this totalTokens — skipping duplicate retry");
                  }
                } catch (e3) {
                  console.error("[stream] cap audit retry failed:", (e3 as Error).message);
                }
                safeEnqueue(sseLine("cap.exceeded", { totalTokens: m.totalTokens ?? 0 }));
                safeEnqueue(sseLine("turn.error", { message: "cap exceeded (audit pending)", state: "error" }));
                return { terminal: true, next };
              }
            } catch (e2) {
              console.error("[stream] stranded cap re-read failed:", (e2 as Error).message);
            }
            // Cap check indeterminate or failed before lock — fail closed with
            // an explicit cap-check error rather than masquerading as a gate error.
            const capDetail = `cap check failed: ${(e as Error).message}`;
            safeEnqueue(sseLine("turn.error", { message: capDetail, state: "error" }));
            try {
              await appendAudit(paperId, {
                id: `cap_err_${Date.now()}`,
                seq: 0,
                createdAt: new Date().toISOString(),
                type: "turn.error",
                payload: { message: capDetail, metrics: m },
              } as unknown as LiveEvent);
            } catch { /* best-effort */ }
            // Persist error status — retry once; if still failing, surface a
            // stable client message without raw DB details (Qodo: Database error
            // details exposed + Status failure leaves run live).
            try {
              await query(`UPDATE papers SET status = 'error', updated_at = now() WHERE id = $1 AND NOT halted`, [paperId]);
            } catch (e3) {
              console.error("[stream] cap-check status=error update failed:", (e3 as Error).message);
              try {
                await query(`UPDATE papers SET status = 'error', updated_at = now() WHERE id = $1 AND NOT halted`, [paperId]);
              } catch (e4) {
                console.error("[stream] cap-check status retry failed:", (e4 as Error).message);
                safeEnqueue(sseLine("turn.error", { message: "failed to persist error status — run may remain live" }));
              }
            }
            return { terminal: true, next: { ...next, status: "error", terminal: { kind: "error" } } as typeof next };
          }
          const detail = "turn.done carried requiredActions but no gate had a persistable threadId/toolCallId";
          console.error(`[stream] ${detail} — surfacing turn.error`);
          safeEnqueue(sseLine("turn.error", { message: detail }));
          // Persist an explicit audited error as turn.error (not turn.done) so
          // rowsFromLiveEvents renders it as an error, not a successful turn.
          try {
            await appendAudit(paperId, {
              id: `stranded_${Date.now()}`,
              seq: 0,
              createdAt: new Date().toISOString(),
              type: "turn.error",
              payload: { message: detail, strandedDetail: detail, originalRequiredActions: event.payload.requiredActions },
            } as unknown as LiveEvent);
          } catch { /* best-effort audit for stranded */ }
          try {
            await query(`UPDATE papers SET status = 'error', updated_at = now() WHERE id = $1 AND NOT halted`, [paperId]);
          } catch (e2) {
            console.error("[stream] stranded papers.status=error update failed:", (e2 as Error).message);
            try {
              await query(`UPDATE papers SET status = 'error', updated_at = now() WHERE id = $1 AND NOT halted`, [paperId]);
            } catch (e3) {
              console.error("[stream] stranded status retry failed:", (e3 as Error).message);
              safeEnqueue(sseLine("turn.error", { message: "failed to persist error status — run may remain live" }));
            }
          }
          safeEnqueue(sseLine("turn.error", { state: "error" }));
          return { terminal: true, next: { ...next, status: "error", terminal: { kind: "error" } } as typeof next };
        }
        // Phase 5.1 — cap guard. Usage arrives with the metrics on
        // turn.done; when the paper's cap is crossed, enforceCap locks
        // the run (halt_reason 'cap') and writes the audit row. The
        // terminal update below skips halted papers, so the hard stop
        // sticks.
        if (event.type === "turn.done") {
          // Qodo round 3 — TrueForge may bundle every
          // `tool.approval_required` gate inside the terminal
          // turn.done payload (via `requiredActions[]`). Iterate
          // requiredActions here and insert any missing gate rows.
          // Use the filtered list if we filtered before reduce.
          const requiredActions = (turnDoneFiltered ?? (event.payload.requiredActions as Array<Record<string, unknown>> | undefined) ?? []);
          for (const act of requiredActions) {
            // Both `tool.approval_required` and `tool.response_required` need
            // a human-in-the-loop surface. TrueForge bundles them inside the
            // terminal `turn.done` payload. Treat both as verify gates.
            if (act?.type !== "tool.approval_required" && act?.type !== "tool.response_required") continue;
            const threadId = String(act.threadId ?? act.thread_id ?? "");
            const tcs = (Array.isArray(act.toolCalls) ? act.toolCalls : Array.isArray(act.tool_calls) ? act.tool_calls : []) as Array<Record<string, unknown>>;
            const first = tcs[0] ?? {};
            const toolCallId = String(
              first.id ??
                first.toolCallId ??
                (first as Record<string, unknown>).tool_call_id ??
                "",
            );
            const toolName = String(
              first.name ??
                first.toolName ??
                (first as Record<string, unknown>).tool_name ??
                "tool",
            );
            // Both thread_id AND tool_call_id are required by the
            // resume contract (TrueForge returns 400 if either is empty).
            if (!threadId || !toolCallId) {
              console.error(
                `[stream] requiredAction missing threadId/toolCallId — skipping gate insert (threadId=${threadId ? "ok" : "empty"} toolCallId=${toolCallId ? "ok" : "empty"} type=${act?.type})`,
              );
              continue;
            }
            try {
              await insertGate({
                paperId,
                threadId,
                toolCallId,
                toolName,
                kind: "verify",
                severity: act.type === "tool.response_required" ? "reversible" : "irreversible",
                payload: act,
              });
            } catch (e) {
              console.error("[stream] requiredAction gate insert failed:", (e as Error).message);
            }
          }
          const m = (event.payload.metrics as { totalTokens?: number; totalCostInUsd?: number } | undefined) ?? {};
          try {
            const stopped = await enforceCap(paperId, {
              totalTokens: m.totalTokens ?? 0,
              totalCostInUsd: m.totalCostInUsd ?? 0,
            });
            if (stopped) {
              safeEnqueue(sseLine("cap.exceeded", { totalTokens: m.totalTokens ?? 0 }));
            }
          } catch (e) {
            console.error("[stream] cap check failed:", (e as Error).message);
          }
        }
        const terminal = classifyTerminal(state);
        if (terminal) {
          safeEnqueue(sseLine(terminal, { state: state.status, metrics: state.metrics }));
          try {
            // Guard: a halted (user-stopped or cap-stopped) paper is
            // locked — the terminal status must not overwrite it.
            await query(
              `UPDATE papers SET status = $1, updated_at = now() WHERE id = $2 AND NOT halted`,
              [state.status, paperId],
            );
          } catch { /* best-effort; the live stream already closed */ }
          return { terminal: true, next };
        }
        return { terminal: false, next };
      };

      try {
        if (closed) return;
        const r1 = await processEvent(firstResult.value);
        if (r1.terminal) { cleanup(); return; }
        for await (const event of wrapWithSeq(turn.iterator)) {
          if (closed) break;
          const r = await processEvent(event);
          if (r.terminal) { cleanup(); return; }
        }
      } catch (e) {
        if (!closed) {
          safeEnqueue(sseLine("turn.error", { message: (e as Error).message }));
        }
      } finally {
        cleanup();
      }
    },
    cancel() {
      closed = true;
      unregisterActiveStream(paperId, streamCancelHook);
      if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
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
// the upstream doesn't supply one. TrueForge events normally carry a
// ULID-derived seq; this is a safety net for tests.
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
