// Phase 3.2 — POST /api/papers/:id/ask
//
// The Ask composer sends free text + @cite tokens; this route scopes
// the question to the named claims/sections and forwards it to GMI.
// The response is streamed back as SSE so the UI can render
// incrementally (LLMs feel slow if we wait for the full answer).
//
// We always log the prompt + response to the `annotations` table so
// the audit trail captures what the user asked (this is a small
// "what did I ask" ledger, not a full chat history).

import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "../../../../../lib/session";
import { query } from "../../../../../lib/db";
import { parseCiteTokens } from "../../../../../lib/cite";
import { gmiChat, gmiConfigured } from "../../../../../lib/gmi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AskBody = { question?: string };

function err(status: number, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return err(401, "authentication required");
  }
  const { id } = await params;

  const paper = await query<{ user_id: string; title: string | null; slug: string }>(
    `SELECT user_id, title, slug FROM papers WHERE id = $1 LIMIT 1`,
    [id],
  );
  if (paper.rows.length === 0) return err(404, "paper not found");
  if (paper.rows[0]!.user_id !== user.sub) return err(403, "forbidden");

  let body: AskBody;
  try { body = (await req.json()) as AskBody; } catch { return err(400, "invalid JSON"); }
  if (!body.question || !body.question.trim()) return err(400, "question is required");

  const { text, cites } = parseCiteTokens(body.question);
  if (text.length === 0) return err(400, "question must contain at least one non-cite character");

  if (!gmiConfigured()) {
    return err(503, "GMI not configured — set GMI_API_KEY in .env");
  }

  // Resolve the cited claims to a context block. The LLM sees both the
  // raw text and the cited evidence so it can answer grounded in the paper.
  // Qodo #4 — defence in depth: only pass through UUID-shaped IDs.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let contextBlock = "";
  if (cites.length > 0) {
    const claimIds = cites
      .filter((c) => c.kind === "claim" && UUID_RE.test(c.id))
      .map((c) => c.id);
    if (claimIds.length > 0) {
      const cited = await query<{ id: string; text: string; evidence: string | null }>(
        `SELECT id, text, evidence FROM claims WHERE paper_id = $1 AND id = ANY($2::uuid[])`,
        [id, claimIds],
      );
      for (const row of cited.rows) {
        contextBlock += `\n- [claim ${row.id}] ${row.text}${row.evidence ? `\n  evidence: ${row.evidence}` : ""}`;
      }
    }
  }

  const system = [
    "You are a research-paper Q&A assistant.",
    "Answer the user's question grounded in the cited evidence below.",
    "If the cited evidence is insufficient, say so explicitly.",
    "Cite claims by their `[claim <id>]` tag in your reply so the UI can link back.",
    "",
    `Paper: ${paper.rows[0]!.title ?? paper.rows[0]!.slug}`,
    contextBlock ? `Cited evidence:${contextBlock}` : "No citations in this question.",
  ].join("\n");

  let answer: string;
  let totalTokens = 0;
  try {
    const r = await gmiChat({
      system,
      messages: [{ role: "user", content: text }],
    });
    answer = r.answer;
    totalTokens = r.usage.totalTokens;
  } catch (e) {
    return err(502, `GMI error: ${(e as Error).message}`);
  }

  // Persist the Q+A so the audit page can show "what was asked".
  // Qodo #3 — the question is stored in the anchor so the audit log can
  // reconstruct both the user's prompt and the LLM's answer.
  await query(
    `INSERT INTO annotations (paper_id, anchor, body) VALUES ($1, $2::jsonb, $3)`,
    [id, JSON.stringify({ kind: "ask", question: body.question, cites, totalTokens }), answer],
  );

  return NextResponse.json({ ok: true, answer, cites, totalTokens });
}
