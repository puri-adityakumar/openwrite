import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { query, closePool } from "../lib/db";
import { __setTrueForgeClientForTest, getTrueForgeClient, FakeTrueForgeClient, type TrueForgeClient } from "../lib/trueforge";

// Phase 5.3 — replay tests.
//
//   1. `replayPaper` creates a NEW TrueForge session for the same
//      paper: new session_id/turn_id, status back to running, a
//      halted run un-halted, the previous audit rows preserved, and
//      a `replay.started` audit row appended.
//   2. `getReplayStatus` — the freshness proof: the replay session's
//      sandbox.created sandboxId must DIFFER from the original run's.
//   3. The fake adapter's freshness contract: two different sessions
//      produce two different sandbox.created sandboxIds.

// Dedicated fixture paper — never the seed paper (…010).
const PID = "00000000-0000-0000-0000-000000000014";

async function ensurePaper() {
  await query(
    `INSERT INTO papers (id, user_id, slug, mode, status, source_url, session_id, turn_id)
     SELECT '00000000-0000-0000-0000-000000000014', id, 'replay-playground', 'review', 'done',
            'https://arxiv.org/abs/1706.03762', 'sess_orig', 'turn_orig'
     FROM users WHERE email = 'demo@local'
     ON CONFLICT (id) DO NOTHING`,
  );
}

async function resetPaper(opts: { status?: string; halted?: boolean } = {}) {
  await ensurePaper();
  await query(
    `UPDATE papers SET status = $2, halted = $3, halt_reason = NULL,
       session_id = 'sess_orig', turn_id = 'turn_orig', cap_usd = NULL, cap_tokens = NULL
     WHERE id = $1`,
    [PID, opts.status ?? "done", opts.halted ?? false],
  );
  await query(`DELETE FROM audit WHERE paper_id = $1`, [PID]);
  await query(`DELETE FROM gates WHERE paper_id = $1`, [PID]);
  // The original run's audit: session start + its sandbox.
  await query(
    `INSERT INTO audit (paper_id, events) VALUES ($1, $2::jsonb), ($1, $3::jsonb)`,
    [
      PID,
      JSON.stringify({ id: "o1", createdAt: new Date().toISOString(), type: "turn.created", payload: {}, seq: 1 }),
      JSON.stringify({ id: "o2", createdAt: new Date().toISOString(), type: "sandbox.created", payload: { sandboxId: "sbx_original" }, seq: 2 }),
    ],
  );
}

beforeEach(async () => {
  await resetPaper();
});

afterAll(async () => {
  __setTrueForgeClientForTest(null);
  await query(`DELETE FROM papers WHERE id = $1`, [PID]);
  await closePool();
});

describe("replay route — config", () => {
  it("exports runtime = 'nodejs'", async () => {
    const mod = await import("../app/api/agent/replay/route");
    expect((mod as { runtime?: string }).runtime).toBe("nodejs");
  });

  it("exports dynamic = 'force-dynamic'", async () => {
    const mod = await import("../app/api/agent/replay/route");
    expect((mod as { dynamic?: string }).dynamic).toBe("force-dynamic");
  });
});

describe("replayPaper — new session for the same paper", () => {
  it("creates a new session + turn, flips the paper to running, preserves old audit", async () => {
    const { replayPaper } = await import("../lib/replay");
    const out = await replayPaper(PID);
    expect(out.sessionId).not.toBe("sess_orig");
    expect(out.turnId).not.toBe("turn_orig");

    const row = await query<{ status: string; session_id: string; halted: boolean }>(
      `SELECT status, session_id, halted FROM papers WHERE id = $1`,
      [PID],
    );
    expect(row.rows[0]!.status).toBe("running");
    expect(row.rows[0]!.session_id).toBe(out.sessionId);
    expect(row.rows[0]!.halted).toBe(false);

    // Old audit preserved + replay marker appended.
    const audit = await query<{ type: string; sandbox: string | null }>(
      `SELECT events->>'type' AS type, events->'payload'->>'sandboxId' AS sandbox
       FROM audit WHERE paper_id = $1 ORDER BY id ASC`,
      [PID],
    );
    const types = audit.rows.map((r) => r.type);
    expect(types[0]).toBe("turn.created"); // original row intact
    expect(types).toContain("sandbox.created");
    expect(types[types.length - 1]).toBe("replay.started");
  });

  it("replaying a HALTED run clears the halt", async () => {
    await resetPaper({ status: "done", halted: true });
    await query(`UPDATE papers SET halt_reason = 'user' WHERE id = $1`, [PID]);
    const { replayPaper } = await import("../lib/replay");
    await replayPaper(PID);
    const row = await query<{ halted: boolean; halt_reason: string | null; status: string }>(
      `SELECT halted, halt_reason, status FROM papers WHERE id = $1`,
      [PID],
    );
    expect(row.rows[0]).toMatchObject({ halted: false, halt_reason: null, status: "running" });
  });

  it("refuses to replay while a run is live (409)", async () => {
    await resetPaper({ status: "running" });
    const { replayPaper, ConflictError } = await import("../lib/replay");
    await expect(replayPaper(PID)).rejects.toBeInstanceOf(ConflictError);
  });

  it("unknown paper throws NotFoundError", async () => {
    const { replayPaper, NotFoundError } = await import("../lib/replay");
    await expect(replayPaper("00000000-0000-0000-0000-00000000dead")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getReplayStatus — the freshness proof", () => {
  it("reports fresh=true once the replay sandbox differs from the original", async () => {
    const { replayPaper, getReplayStatus } = await import("../lib/replay");
    await replayPaper(PID);

    // No replay sandbox streamed yet.
    const before = await getReplayStatus(PID);
    expect(before).toMatchObject({ fresh: false, originalSandboxId: "sbx_original", replaySandboxId: null });

    // The replayed turn's stream persists its own sandbox.created —
    // simulate the stream having run with a DIFFERENT sandbox id.
    await query(
      `INSERT INTO audit (paper_id, events) VALUES ($1, $2::jsonb)`,
      [PID, JSON.stringify({ id: "r9", createdAt: new Date().toISOString(), type: "sandbox.created", payload: { sandboxId: "sbx_replay_1" }, seq: 3 })],
    );
    const after = await getReplayStatus(PID);
    expect(after).toMatchObject({ fresh: true, originalSandboxId: "sbx_original", replaySandboxId: "sbx_replay_1" });
  });
});

describe("fake adapter — per-session sandbox freshness", () => {
  it("two different sessions yield two different sandbox.created ids", async () => {
    // Explicitly inject a FakeTrueForgeClient regardless of TRUEFORGE_MODE
    // (these tests exercise the fake adapter's session/turn keying).
    __setTrueForgeClientForTest(new FakeTrueForgeClient());
    const client: TrueForgeClient = getTrueForgeClient();
    const s1 = await client.startSession({ paperId: PID, mode: "review", source: "fixture:demo" });
    const s2 = await client.startSession({ paperId: PID, mode: "review", source: "fixture:demo" });
    expect(s1.sessionId).not.toBe(s2.sessionId);

    const t1 = await client.createTurnStream(s1.sessionId, s1.turnId);
    const t2 = await client.createTurnStream(s2.sessionId, s2.turnId);
    const e1 = (await t1.iterator.next()).value as { type: string; payload: { sandboxId?: string } };
    const e2 = (await t2.iterator.next()).value as { type: string; payload: { sandboxId?: string } };
    expect(e1.type).toBe("turn.created");
    let sandbox1: string | undefined;
    for (;;) {
      const ev = (await t1.iterator.next()).value as { type: string; payload: { sandboxId?: string } } | undefined;
      if (!ev || ev.type === "sandbox.created") { sandbox1 = ev?.payload.sandboxId; break; }
    }
    for (;;) {
      const ev = (await t2.iterator.next()).value as { type: string; payload: { sandboxId?: string } } | undefined;
      if (!ev || ev.type === "sandbox.created") {
        expect(ev?.payload.sandboxId).toBeDefined();
        expect(ev!.payload.sandboxId).not.toBe(sandbox1);
        break;
      }
    }
    void e2;
  });

  it("re-streaming the SAME turn is stable (reload-safe ids)", async () => {
    __setTrueForgeClientForTest(new FakeTrueForgeClient());
    const client = getTrueForgeClient();
    const s = await client.startSession({ paperId: PID, mode: "review", source: "fixture:demo" });
    const a = await client.createTurnStream(s.sessionId, s.turnId);
    const b = await client.createTurnStream(s.sessionId, s.turnId);
    const sandboxOf = async (t: { iterator: AsyncIterableIterator<{ type: string; payload: { sandboxId?: string } }> }) => {
      for (;;) {
        const ev = (await t.iterator.next()).value;
        if (!ev || ev.type === "sandbox.created") return ev?.payload.sandboxId;
      }
    };
    expect(await sandboxOf(a)).toBe(await sandboxOf(b));
  });
});

describe("replayPaper — pending-gate supersession (Qodo review round 2)", () => {
  it("supersedes a pending gate on replay (expired with reason) instead of carrying it across", async () => {
    await resetPaper({ status: "paused" });
    const thrId = `thr_old_${Math.random().toString(36).slice(2, 8)}`;
    const tcId = `tc_old_${Math.random().toString(36).slice(2, 8)}`;
    await query(
      `INSERT INTO gates (paper_id, kind, severity, status, payload, thread_id, tool_call_id, tool_name, expires_at)
       VALUES ($1, 'verify', 'irreversible', 'pending', '{}'::jsonb, $2, $3, 'bash', now() + interval '5 minutes')`,
      [PID, thrId, tcId],
    );
    const { replayPaper } = await import("../lib/replay");
    // Replay stays available from the paused state (the audit page's
    // "Replay this audit" IS the restart path) — but the old gate is
    // superseded so it can never resume against the NEW session.
    const out = await replayPaper(PID);
    expect(out.sessionId).not.toBe("sess_orig");
    const gate = await query<{ status: string; decided_reason: string | null }>(
      `SELECT status, decided_reason FROM gates WHERE thread_id = $1 AND tool_call_id = $2`,
      [thrId, tcId],
    );
    expect(gate.rows[0]).toMatchObject({ status: "expired", decided_reason: "superseded by replay" });
    // And the new run's paper row is running on the new session.
    const row = await query<{ status: string; session_id: string }>(
      `SELECT status, session_id FROM papers WHERE id = $1`,
      [PID],
    );
    expect(row.rows[0]).toMatchObject({ status: "running", session_id: out.sessionId });
  });

  it("replays fine once the gate is decided (no pending gates left)", async () => {
    await resetPaper({ status: "paused" });
    await query(
      `INSERT INTO gates (paper_id, kind, severity, status, payload, thread_id, tool_call_id, tool_name, expires_at, decided_at, decided_reason)
       VALUES ($1, 'verify', 'irreversible', 'denied', '{}'::jsonb, $2, $3, 'bash', now() + interval '5 minutes', now(), 'nope')`,
      [PID, `thr_dec_${Math.random().toString(36).slice(2, 8)}`, `tc_dec_${Math.random().toString(36).slice(2, 8)}`],
    );
    const { replayPaper } = await import("../lib/replay");
    const out = await replayPaper(PID);
    expect(out.sessionId).not.toBe("sess_orig");
  });
});
