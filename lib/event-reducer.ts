// Phase 2.1 — pure event reducer for the TrueForge SSE stream.
//
// The reducer is the single source of truth for the cockpit's live state.
// The route handler in app/api/agent/stream/route.ts pushes every event
// through reduce() and pipes the resulting state into the SSE frame body
// AND into the `audit` table (every event is persisted, per Phase 2.1#5).
//
// P7 binding constraints honored here:
//   P7#3: turn.done + requiredActions.length > 0  -> status "paused"
//   P7#3: turn.done plain                          -> status "done"
//   P7#5: unknown threadId -> "[agent]" (real role resolution lives in
//         lib/thread-map.ts which reduce() consults via the optional
//         `roles` arg).
//
// Cost display rule (architecture): when totalCostInUsd === 0 (the GMI
// custom provider) we display "—" and let the UI fall back to totalTokens.

export type CoveragePage = { page: number; density: number };
export type Gate = { threadId: string; toolCallId: string; toolName: string };
export type LiveStatus = "queued" | "running" | "paused" | "done" | "error";

export type Metrics = {
  totalTokens: number;
  costDisplay: string; // "—" or "$0.012"
};

export type LiveState = {
  status: LiveStatus;
  seq: number; // highest seq we've accepted; used to dedupe + drop out-of-order
  coverage: CoveragePage[];
  pulse: string[]; // bounded; we keep the last 200 lines
  metrics: Metrics;
  gates: Gate[];
  sandboxId: string | null;
  // Last messageId we appended a delta for — used for coalescing.
  lastDeltaMessageId: string | null;
  // Last terminal event (so the writer can decide to emit `event: turn.paused`
  // vs `event: turn.done`).
  terminal: { kind: "done" | "paused" | "error" } | null;
};

export type LiveEvent = {
  id: string;
  seq: number;
  createdAt: string;
  type:
    | "turn.created"
    | "turn.done"
    | "model.message.delta"
    | "tool.response"
    | "tool.approval_required"
    | "thread.created"
    | "thread.done"
    | "sandbox.created"
    | "mcp.initialize";
  payload: Record<string, unknown>;
  // Server-side mirror of the resolved threadId→role map so the client
  // store can apply the same role prefix without re-parsing event text.
  // Optional — older events from the seed path don't carry it.
  _roles?: Record<string, string>;
};

const MAX_PULSE = 200;

function formatCost(costUsd: number | undefined): string {
  if (costUsd === undefined || costUsd === null) return "—";
  if (costUsd === 0) return "—";
  return `$${costUsd.toFixed(3)}`;
}

function nowHHMMSS(iso: string): string {
  // SSE pulse lines start with HH:MM:SS — same shape as the seed.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "00:00:00";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function appendPulse(state: LiveState, line: string): LiveState {
  const next = state.pulse.length >= MAX_PULSE ? state.pulse.slice(-MAX_PULSE + 1) : state.pulse.slice();
  next.push(line);
  return { ...state, pulse: next };
}

function rolePrefix(threadId: string | undefined, roles: Map<string, string> | undefined): string {
  if (!threadId) return "[agent]";
  const r = roles?.get(threadId);
  return r ? `[${r}]` : "[agent]";
}

export function initialState(): LiveState {
  return {
    status: "queued",
    seq: 0,
    coverage: [],
    pulse: [],
    metrics: { totalTokens: 0, costDisplay: "—" },
    gates: [],
    sandboxId: null,
    lastDeltaMessageId: null,
    terminal: null,
  };
}

export type ReduceOptions = {
  // Optional threadId -> role map (Phase 2.2). When omitted, every event
  // uses "[agent]" — that is the safe fallback.
  roles?: Map<string, string>;
};

export function reduce(state: LiveState, event: LiveEvent, opts: ReduceOptions = {}): LiveState {
  // Sequence-number guard: drop duplicates and out-of-order events.
  // Treat seq: 0 / undefined as "uncursorable" (test fakes, legacy callers)
  // and always accept them. Real TrueForge events always carry a positive seq.
  if (typeof event.seq === "number" && event.seq > 0) {
    if (event.seq <= state.seq) return state;
  }

  const next: LiveState = {
    ...state,
    seq: typeof event.seq === "number" && event.seq > 0 ? event.seq : state.seq,
  };
  const time = nowHHMMSS(event.createdAt);

  switch (event.type) {
    case "turn.created": {
      next.status = "running";
      return appendPulse(next, `${time} [agent]    turn started`);
    }

    case "model.message.delta": {
      const messageId = String(event.payload.messageId ?? "");
      const role = rolePrefix(event.payload.threadId as string | undefined, opts.roles);
      const delta = String(event.payload.delta ?? "");
      const p = next.pulse.slice();
      if (next.lastDeltaMessageId === messageId && p.length > 0) {
        p[p.length - 1] = `${p[p.length - 1]}${delta}`;
      } else {
        p.push(`${time} ${role.padEnd(11)} ${messageId}: ${delta}`);
      }
      if (p.length > MAX_PULSE) p.splice(0, p.length - MAX_PULSE);
      next.pulse = p;
      next.lastDeltaMessageId = messageId || null;
      return next;
    }

    case "tool.response": {
      const role = rolePrefix(event.payload.threadId as string | undefined, opts.roles);
      const tool = String(event.payload.toolName ?? "tool");
      const page = event.payload.page as number | undefined;
      const density = event.payload.density as number | undefined;
      if (typeof page === "number" && typeof density === "number") {
        const existing = next.coverage.find((c) => c.page === page);
        if (existing) {
          next.coverage = next.coverage.map((c) =>
            c.page === page ? { ...c, density: Math.max(c.density, density) } : c,
          );
        } else {
          next.coverage = [...next.coverage, { page, density }].sort((a, b) => a.page - b.page);
        }
      }
      return appendPulse(next, `${time} ${role.padEnd(11)} ${tool} -> ok`);
    }

    case "thread.created": {
      const role = rolePrefix(event.payload.threadId as string | undefined, opts.roles);
      const title = String(event.payload.title ?? "subagent");
      return appendPulse(next, `${time} ${role.padEnd(11)} subagent: ${title}`);
    }

    case "thread.done": {
      const role = rolePrefix(event.payload.threadId as string | undefined, opts.roles);
      return appendPulse(next, `${time} ${role.padEnd(11)} subagent done`);
    }

    case "sandbox.created": {
      const sandboxId = String(event.payload.sandboxId ?? "");
      next.sandboxId = sandboxId;
      return appendPulse(next, `${time} [sandbox]  ${sandboxId} (fresh)`);
    }

    case "tool.approval_required": {
      const gate: Gate = {
        threadId: String(event.payload.threadId ?? ""),
        toolCallId: String(event.payload.toolCallId ?? ""),
        toolName: String(event.payload.toolName ?? "tool"),
      };
      next.gates = [...next.gates, gate];
      return appendPulse(next, `${time} [gate]     ${gate.toolName} (${gate.toolCallId}) awaiting approval`);
    }

    case "mcp.initialize": {
      const server = String(event.payload.server ?? "mcp");
      return appendPulse(next, `${time} [mcp]      ${server} ready`);
    }

    case "turn.done": {
      const requiredActions = (event.payload.requiredActions as unknown[] | undefined) ?? [];
      const metrics = (event.payload.metrics as { totalTokens?: number; totalCostInUsd?: number } | undefined) ?? {};
      next.metrics = {
        totalTokens: metrics.totalTokens ?? 0,
        costDisplay: formatCost(metrics.totalCostInUsd),
      };
      if (requiredActions.length > 0) {
        next.status = "paused";
        next.terminal = { kind: "paused" };
        return appendPulse(next, `${time} [agent]    turn paused on ${requiredActions.length} gate(s)`);
      }
      const stateStr = String(event.payload.state ?? "done");
      if (stateStr === "error") {
        next.status = "error";
        next.terminal = { kind: "error" };
        return appendPulse(next, `${time} [agent]    turn errored`);
      }
      next.status = "done";
      next.terminal = { kind: "done" };
      return appendPulse(next, `${time} [agent]    turn done · ${next.metrics.totalTokens} tokens`);
    }

    default: {
      return appendPulse(next, `${time} [agent]    unknown event ${(event as { type: string }).type}`);
    }
  }
}

// Derived view: the 6 Trail pill states from current state. The Trail
// component consumes this so the pill state is always a pure function of
// the reducer state (single source of truth per Phase 2.3#1).
export type TrailPill = { id: string; label: string; state: "done" | "running" | "pending" | "error" };

const TRAIL_ORDER: { id: string; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "parse", label: "Parse" },
  { id: "extract", label: "Extract" },
  { id: "score", label: "Score" },
  { id: "verify", label: "Verify" },
  { id: "done", label: "Done" },
];

export function deriveTrail(state: LiveState): TrailPill[] {
  // Map the events we've seen onto Trail progress.
  let sourceDone = false;
  let parseDone = false;
  let extractDone = false;
  let scoreDone = false;
  let verifyHit = false;
  for (const line of state.pulse) {
    if (line.includes("turn started")) sourceDone = true;
    if (line.includes("[reader]") || line.includes("m1:")) parseDone = true;
    if (line.includes("-> ok")) extractDone = true;
    if (line.includes("subagent:")) scoreDone = true;
    if (line.includes("[gate]")) verifyHit = true;
  }
  const isPaused = state.status === "paused";
  const isErrored = state.status === "error";
  const isDone = state.status === "done";
  // Qodo #8: a successful run with no approval gate should mark Verify
  // as done (not "running"). The pill is complete when the run reaches
  // the terminal `done` state. A gate-hit run keeps Verify "running"
  // while paused (the agent is awaiting approval at that stage).
  const verifyDone = verifyHit || isDone;
  const stages: boolean[] = [
    sourceDone,
    parseDone,
    extractDone,
    scoreDone,
    // verify: complete on a normal run end, OR when a gate fires and
    // the run then completes. While paused, mark false so the
    // running-pill index lands on it.
    verifyDone && !isPaused && !isErrored,
    isDone,
  ];
  if (isErrored) {
    const err = [...stages];
    const lastTrue = err.lastIndexOf(true);
    return TRAIL_ORDER.map((p, i) => {
      if (i < lastTrue) return { id: p.id, label: p.label, state: "done" };
      if (i === lastTrue) return { id: p.id, label: p.label, state: "error" };
      return { id: p.id, label: p.label, state: "pending" };
    });
  }
  const runningIdx = stages.findIndex((d) => !d);
  return TRAIL_ORDER.map((p, i) => {
    if (i < runningIdx) return { id: p.id, label: p.label, state: "done" };
    if (i === runningIdx) return { id: p.id, label: p.label, state: "running" };
    return { id: p.id, label: p.label, state: "pending" };
  });
}
