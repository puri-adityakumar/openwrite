"use client";

// Phase 3 — LiveCockpit is a thin wrapper that wires the SSE store
// into CockpitClient. The bulk of the rendering lives in
// CockpitClient so the seed and live paths share every surface.

import { useCockpitState } from "../lib/sse-store";
import { CockpitClient } from "./CockpitClient";
import { initialState } from "../lib/event-reducer";

export function LiveCockpit({
  slug,
  title,
  paperId,
  streamUrl,
  pdfUrl,
}: {
  slug: string;
  title: string;
  paperId: string;
  streamUrl: string;
  pdfUrl: string | null;
}) {
  const { state, pills } = useCockpitState(streamUrl);
  return (
    <CockpitClient
      slug={slug}
      title={title}
      paperId={paperId}
      pills={pills}
      coverage={state.coverage}
      liveState={state}
      summary={{
        // The live run has no structured summary until Phase 4 wires the
        // extract step. Until then we render a placeholder so the Summary
        // tab is not blank.
        title,
        abstract: "The live run has not yet produced an abstract. Check back when the extract step completes (Phase 4).",
        tldr: "Awaiting live extract…",
        claims_count: 0,
        evidence_count: 0,
      }}
      pdfUrl={pdfUrl}
    />
  );
}

// Re-export for any test that imports the empty initial state.
export { initialState };
