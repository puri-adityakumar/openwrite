import type { LiveState } from "../lib/event-reducer";

const MAX_PULSE_LINES = 5;

export function Pulse({
  state,
  lastHeartbeat,
}: {
  state: LiveState;
  lastHeartbeat: string | null;
}) {
  const hbSlot = lastHeartbeat ? 1 : 0;
  const eventSlots = Math.max(0, MAX_PULSE_LINES - hbSlot);
  const lines = state.pulse.slice(-eventSlots);
  const visible = lastHeartbeat ? lines.length + 1 : lines.length;
  return (
    <pre
      className="mt-2 rounded border border-[var(--color-border)] bg-[var(--color-secondary)] p-3 text-xs font-mono leading-5 overflow-x-auto"
      style={{ minHeight: "7.5rem" }}
      data-testid="pulse"
      data-line-count={visible}
    >
      {lines.length === 0 && !lastHeartbeat ? (
        <div className="text-[var(--color-muted-foreground)]" data-testid="pulse-empty">
          <div>Awaiting the first event from the agent.</div>
          <div className="mt-1 text-[10px] opacity-75">
            Each line below will show the role, tool, and timestamp as the pipeline runs source → parse → extract → score → verify.
          </div>
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
              className="text-[var(--color-muted-foreground)]"
            >
              {lastHeartbeat} · hb
            </div>
          )}
        </>
      )}
    </pre>
  );
}
