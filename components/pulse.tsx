import type { LiveState } from "../lib/event-reducer";

const MAX_PULSE_LINES = 5;

// Detects a leading role prefix like "[agent]" / "[reader]" and returns
// the role token (without brackets) or null if none was found. The role
// token drives a colored chip; the original `[role]` text is preserved
// in the line so existing tests that grep for the bracket form keep
// passing.
const ROLE_RE = /^\[([a-z]+)\]/;

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
          {lines.map((line, i) => {
            const match = line.match(ROLE_RE);
            const role = match?.[1] ?? null;
            const rest = role ? line.slice(match![0].length) : line;
            const isLast = i === lines.length - 1;
            // The line-enter animation fires only on the newest line.
            // We key the last line on state.pulse.length so a new event
            // remounts just that node and replays the slide-in — the
            // older lines keep their index key and stay put.
            return (
              <div
                key={isLast ? `last-${state.pulse.length}` : i}
                data-testid="pulse-line"
                data-line-index={i}
                data-role={role ?? undefined}
                className={isLast ? "pulse-line-enter" : undefined}
              >
                {role && (
                  <span className="pulse-role" data-role={role}>{`[${role}]`}</span>
                )}
                {rest}
              </div>
            );
          })}
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