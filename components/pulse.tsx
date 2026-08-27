// Phase 3.1 — Pulse component.
//
// Pinned by docs/ui-mockups.md and the Phase 3 plan:
//   - exactly 5 lines
//   - monospace, HH:MM:SS [role] message format
//   - 15 s heartbeat line at the bottom (when lastHeartbeat is set)
//
// Pure presentational component — the SSE store feeds it the last N
// pulse lines and the last heartbeat timestamp. The cap is enforced
// here (defence in depth — the reducer also caps at 200 but the UI
// only ever shows 5).

import type { LiveState } from "../lib/event-reducer";

const MAX_PULSE_LINES = 5;

export function Pulse({
  state,
  lastHeartbeat,
}: {
  state: LiveState;
  lastHeartbeat: string | null;
}) {
  const lines = state.pulse.slice(-MAX_PULSE_LINES);
  return (
    <pre
      className="mt-2 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs font-mono leading-5 overflow-x-auto"
      data-testid="pulse"
    >
      {lines.length === 0 ? (
        <div className="text-[var(--muted)]" data-testid="pulse-empty">
          — waiting for events —
        </div>
      ) : (
        lines.map((line, i) => (
          <div key={i} data-testid="pulse-line" data-line-index={i}>
            {line}
          </div>
        ))
      )}
      {lastHeartbeat && (
        <div
          data-testid="pulse-heartbeat"
          className="text-[var(--muted)]"
        >
          {lastHeartbeat} · hb
        </div>
      )}
    </pre>
  );
}
