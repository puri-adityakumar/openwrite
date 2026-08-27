// Phase 3.1 — Pulse component.
//
// Pinned by docs/ui-mockups.md and the Phase 3 plan:
//   - exactly 5 lines TOTAL (event lines + heartbeat share the cap;
//     Qodo #5 — heartbeat counts as one of the 5, not a 6th line)
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
  // If a heartbeat is present, reserve one slot for it. The remaining
  // slots are for event lines, taking the most recent first.
  const hbSlot = lastHeartbeat ? 1 : 0;
  const eventSlots = Math.max(0, MAX_PULSE_LINES - hbSlot);
  const lines = state.pulse.slice(-eventSlots);
  const visible = lastHeartbeat ? lines.length + 1 : lines.length;
  return (
    <pre
      className="mt-2 rounded border border-[var(--border)] bg-[var(--panel-2)] p-3 text-xs font-mono leading-5 overflow-x-auto min-h-[7.5rem]"
      data-testid="pulse"
      data-line-count={visible}
    >
      {lines.length === 0 && !lastHeartbeat ? (
        <div className="text-[var(--muted)]" data-testid="pulse-empty">
          — waiting for events —
        </div>
      ) : (
        <>
          {lines.map((line, i) => (
            <div key={i} data-testid="pulse-line" data-line-index={i}>
              {line}
            </div>
          ))}
          {lastHeartbeat && (
            <div
              data-testid="pulse-heartbeat"
              className="text-[var(--muted)]"
            >
              {lastHeartbeat} · hb
            </div>
          )}
        </>
      )}
    </pre>
  );
}
