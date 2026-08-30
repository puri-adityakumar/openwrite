// Phase 3.3 — GET /api/env-status
//
// Returns which required env keys are present. The EnvBanner polls
// this every 15 s + on window focus. We only return booleans (never
// the key values) and we never echo the keys back in any form.

import { NextResponse } from "next/server";
import { gmiConfigured } from "../../../lib/gmi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const daytona = !!process.env.DAYTONA_API_KEY && process.env.DAYTONA_API_KEY !== "replace-me";
  return NextResponse.json({
    ok: true,
    mode: "live" as const,
    status: {
      gmi: gmiConfigured(),
      daytona,
    },
  });
}
