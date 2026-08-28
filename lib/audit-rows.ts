// Phase 5.2 — audit timeline mapping (PURE module).
//
// Both the live `audit` table rows (one jsonb LiveEvent per row) and
// the seed_audits first-paint payload map into the SAME AuditRow
// shape, so /paper/:slug/audit renders either source identically —
// that is the Phase 1 parity invariant, now proved visually.
//
// Row vocabulary follows docs/ui-mockups.md:
//   ▶ session started      ✓ fetched/subagent/tool rows
//   ⏸ Verify requested     ✓ user allowed / ✗ user denied
//   ⏹ stopped / cap exceeded

export type AuditRow = { ts: string; icon: string; message: string };

function hhmmss(iso: unknown): string {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

type AnyEvent = { id?: string; createdAt?: string; type?: string; payload?: Record<string, unknown> };

export function rowsFromLiveEvents(events: AnyEvent[]): AuditRow[] {
  const rows: AuditRow[] = [];
  for (const e of events) {
    const p = (e.payload ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "turn.created":
        rows.push({ ts: hhmmss(e.createdAt), icon: "▶", message: "session started" });
        break;
      case "sandbox.created":
        rows.push({ ts: hhmmss(e.createdAt), icon: "✓", message: `sandbox created: ${String(p.sandboxId ?? "?")}` });
        break;
      case "mcp.initialize":
        rows.push({ ts: hhmmss(e.createdAt), icon: "✓", message: "mcp initialized" });
        break;
      case "thread.created":
        rows.push({
          ts: hhmmss(e.createdAt),
          icon: "✓",
          message: `subagent: ${String(p.title ?? p.threadId ?? "?")}`,
        });
        break;
      case "tool.response":
        rows.push({ ts: hhmmss(e.createdAt), icon: "✓", message: `${String(p.toolName ?? "tool")} ok` });
        break;
      case "tool.approval_required":
        rows.push({ ts: hhmmss(e.createdAt), icon: "⏸", message: "Verify requested" });
        break;
      case "gate.decision": {
        const decision = String(p.decision ?? "");
        rows.push(
          decision === "allow"
            ? { ts: hhmmss(e.createdAt), icon: "✓", message: "user allowed" }
            : {
                ts: hhmmss(e.createdAt),
                icon: "✗",
                message: `user denied${p.reason ? ` — ${String(p.reason)}` : ""}`,
              },
        );
        break;
      }
      case "halt.pause":
        rows.push({ ts: hhmmss(e.createdAt), icon: "⏸", message: "paused by user" });
        break;
      case "halt.stop":
        rows.push({
          ts: hhmmss(e.createdAt),
          icon: "⏹",
          message: p.reason === "cap" ? "stopped — cap exceeded" : "stopped by user",
        });
        break;
      case "cap.exceeded":
        rows.push({
          ts: hhmmss(e.createdAt),
          icon: "⏹",
          message: `cap exceeded (${Number(p.totalTokens ?? 0).toLocaleString("en-US")} tokens)`,
        });
        break;
      case "replay.started":
        rows.push({ ts: hhmmss(e.createdAt), icon: "▶", message: "replay started" });
        break;
      case "replay.sandbox":
        rows.push({ ts: hhmmss(e.createdAt), icon: "✓", message: `fresh sandbox: ${String(p.sandboxId ?? "?")}` });
        break;
      case "turn.done": {
        const required = Array.isArray(p.requiredActions) ? p.requiredActions : [];
        rows.push({
          ts: hhmmss(e.createdAt),
          icon: required.length > 0 ? "⏸" : "✓",
          message: required.length > 0 ? `turn paused on ${required.length} gate(s)` : "turn done",
        });
        break;
      }
      // model.message.delta / thread.done / turn.error-less noise:
      // intentionally not timeline rows.
      default:
        break;
    }
  }
  return rows;
}

// SeedEvents-lite shape (trail pills + pulse lines) — the seed_audits
// first-paint payload. Kept structural so the audit page and the
// parity script can feed either the real seed or a fixture.
export function rowsFromSeedEvents(seed: {
  trail?: { pills?: Array<{ label?: string; state?: string }> };
  pulse?: string[];
}): AuditRow[] {
  const rows: AuditRow[] = [];
  for (const pill of seed.trail?.pills ?? []) {
    rows.push({ ts: "—", icon: "▶", message: String(pill.label ?? "") });
  }
  for (const line of seed.pulse ?? []) {
    rows.push({ ts: "—", icon: "✓", message: String(line) });
  }
  return rows;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Footer totals: "Total tokens N · Cost — · Duration Mm Ss" with the
// architecture cost rule — a real cost shows as $X only when the
// provider reports one; total_cost_in_usd === 0 renders "—".
export function auditFooter(events: AnyEvent[]): string {
  let tokens: number | null = null;
  let costUsd: number | null = null;
  let lastTs: number | null = null;
  let firstTs: number | null = null;
  for (const e of events) {
    const t = e.createdAt ? new Date(e.createdAt).getTime() : NaN;
    if (!Number.isNaN(t)) {
      if (firstTs === null) firstTs = t;
      lastTs = t;
    }
    const m = e.payload?.metrics as { totalTokens?: number; totalCostInUsd?: number } | undefined;
    if (m && typeof m.totalTokens === "number" && m.totalTokens > 0) {
      tokens = m.totalTokens;
      costUsd = typeof m.totalCostInUsd === "number" && m.totalCostInUsd > 0 ? m.totalCostInUsd : 0;
    }
  }
  const tokenPart = tokens === null ? "—" : tokens.toLocaleString("en-US");
  const costPart = costUsd !== null && costUsd > 0 ? `$${costUsd}` : "—";
  const durationPart =
    firstTs !== null && lastTs !== null ? formatDuration((lastTs - firstTs) / 1000) : "—";
  return `Total tokens ${tokenPart}  ·  Cost ${costPart}  ·  Duration ${durationPart}`;
}
