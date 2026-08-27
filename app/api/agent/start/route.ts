// Phase 1.3 — POST /api/agent/start stub.
// Returns 501 with a clear message until Phase 2 wires the TrueForge
// turn session. The /paper/new form surfaces this in the UI.

import { NextResponse, type NextRequest } from "next/server";

export async function POST(_req: NextRequest): Promise<NextResponse> {
  return NextResponse.json(
    { ok: false, error: "Agent wiring lands in Phase 2." },
    { status: 501 },
  );
}
