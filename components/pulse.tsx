import { useEffect, useRef } from "react";
import { Md } from "./md";
import type { LiveState } from "../lib/event-reducer";

// The run log as a chat feed (ChatGPT-style), not a raw terminal dump.
//
// Wire shapes produced by lib/event-reducer.ts:
//   `${time} ${role.padEnd(11)} ${messageId}: ${delta…}` — model prose.
//     Deltas append to the same line, so ONE pulse line holds the whole
//     message, newlines included. Rendered as a chat bubble with the
//     markdown subset from components/md.tsx; the messageId is dropped.
//   `${time} ${role.padEnd(11)} ${tool} -> ok`           — tool response;
//     rendered as a compact chip row.
//   any other stamped line (turn started, subagent, gate, sandbox, mcp)
//     — compact muted activity row. Untimestamped lines (seed data)
//     render the same way, without a time.
//
// Role chips keep the literal `[role]` bracket text (tests and e2e grep
// for it) and reuse the .pulse-role color system in globals.css.

type PulseEntry =
  | { kind: "activity"; time: string; role: string; text: string }
  | { kind: "tool"; time: string; role: string; name: string; outcome: string }
  | { kind: "message"; time: string; role: string; text: string };

const LINE_RE = /^(\d{2}:\d{2}:\d{2}) \[([^\]]+)\]\s*([\s\S]*)$/;
const MESSAGE_RE = /^([A-Za-z0-9][\w.-]{4,}): ([\s\S]+)$/;
const TOOL_RE = /^(\S+) -> (.+)$/;

export function toPulseEntry(line: string): PulseEntry {
  const m = line.match(LINE_RE);
  if (!m) {
    // Seed data arrives as plain prose lines with no stamp.
    return { kind: "activity", time: "", role: "agent", text: line };
  }
  const time = m[1]!;
  const role = m[2]!;
  const content = m[3]!;

  // Fixed-verb event lines first — they must never be mistaken for
  // model prose (e.g. "subagent: <title>" also contains a colon).
  if (content === "turn started" || content === "subagent done") {
    return { kind: "activity", time, role, text: content };
  }
  if (content.startsWith("subagent: ")) {
    return { kind: "activity", time, role, text: content };
  }
  if (content.endsWith(" awaiting approval")) {
    return { kind: "activity", time, role, text: content };
  }
  if (role === "sandbox" || role === "mcp") {
    return { kind: "activity", time, role, text: content };
  }

  // Model message: `<messageId>: <markdown body>`.
  const msg = content.match(MESSAGE_RE);
  if (msg) {
    return { kind: "message", time, role, text: msg[2]! };
  }

  // Tool response: `<tool> -> <outcome>`.
  const tool = content.match(TOOL_RE);
  if (tool) {
    return { kind: "tool", time, role, name: tool[1]!, outcome: tool[2]! };
  }

  return { kind: "activity", time, role, text: content };
}

function PulseRow({ entry, isLast }: { entry: PulseEntry; isLast: boolean }) {
  const anim = isLast ? " pulse-line-enter" : "";
  if (entry.kind === "message") {
    return (
      <div className={`pulse-msg${anim}`} data-testid="pulse-line" data-kind="message">
        <div className="pulse-msg-head">
          <span className="pulse-role" data-role={entry.role}>{`[${entry.role}]`}</span>
          <span className="pulse-time">{entry.time}</span>
        </div>
        <Md text={entry.text} />
      </div>
    );
  }
  if (entry.kind === "tool") {
    return (
      <div className={`pulse-row pulse-row-tool${anim}`} data-testid="pulse-line" data-kind="tool">
        <span className="pulse-time">{entry.time}</span>
        <span className="pulse-role" data-role={entry.role}>{`[${entry.role}]`}</span>
        <span className="pulse-tool-name">{entry.name}</span>
        <span className="pulse-tool-outcome" data-ok={entry.outcome === "ok"}>{entry.outcome}</span>
      </div>
    );
  }
  return (
    <div className={`pulse-row${anim}`} data-testid="pulse-line" data-kind="activity">
      <span className="pulse-time">{entry.time}</span>
      <span className="pulse-role" data-role={entry.role}>{`[${entry.role}]`}</span>
      <span className="pulse-text">{entry.text}</span>
    </div>
  );
}

export function Pulse({
  state,
  lastHeartbeat,
}: {
  state: LiveState;
  lastHeartbeat: string | null;
}) {
  const entries = state.pulse.map(toPulseEntry);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // ChatGPT behavior: the feed sticks to the newest entry.
  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.pulse.length, lastHeartbeat]);

  const visible = entries.length + (lastHeartbeat ? 1 : 0);
  return (
    <div
      className="pulse-feed"
      data-testid="pulse"
      data-line-count={visible}
      role="log"
      aria-label="Run log"
      ref={feedRef}
    >
      {entries.length === 0 && !lastHeartbeat ? (
        <div className="pulse-empty" data-testid="pulse-empty">
          <div>Waiting for the first event from the agent.</div>
          <div className="pulse-empty-hint">
            Tool calls stream as chips; the agent's messages render as chat bubbles.
          </div>
        </div>
      ) : (
        <>
          {entries.map((e, i) => (
            <PulseRow key={i} entry={e} isLast={i === entries.length - 1} />
          ))}
          {lastHeartbeat && (
            <div className="pulse-hb" data-testid="pulse-heartbeat">
              {lastHeartbeat} · hb
            </div>
          )}
        </>
      )}
    </div>
  );
}
