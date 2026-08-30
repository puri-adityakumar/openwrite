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
  halted = false,
  capUsd = null,
  capTokens = null,
}: {
  slug: string;
  title: string;
  paperId: string;
  streamUrl: string;
  pdfUrl: string | null;
  halted?: boolean;
  capUsd?: number | null;
  capTokens?: number | null;
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
        // The live run has no structured summary until the extract step
        // completes; render an honest placeholder so the tab is not blank.
        title,
        abstract: "The agent hasn't written the summary yet. It appears here as soon as the extract step finishes.",
        tldr: "First line of the summary lands here once the agent has read the paper.",
        claims_count: 0,
        evidence_count: 0,
      }}
      pdfUrl={pdfUrl}
      halted={halted}
      capUsd={capUsd}
      capTokens={capTokens}
    />
  );
}

// Re-export for any test that imports the empty initial state.
export { initialState };
