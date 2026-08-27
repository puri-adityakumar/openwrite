// Phase 3.3 — env banner.
//
// Pinned by docs/architecture.md + Phase 3 plan:
//   - One-line banner when a required key (GMI, Daytona) is absent.
//   - Copyable curl command that writes the key into .env.
//   - Polls every 15 s + immediately on window focus (P9 fix — never 5 s).
//   - Sandbox-preview badge on the Verify card when Daytona key absent
//     (the verify card lands in Phase 4; the flag is exposed here for
//     Phase 4 to consume).
//
// The banner is a controlled component: the parent polls and feeds
// the latest status. This keeps the component pure and testable
// (the poll cadence test is a unit test against a fake timer, not a
// full server-render round trip).

"use client";

import { useEffect } from "react";

export type EnvStatus = { gmi: boolean; daytona: boolean };

const MISSING_KEY: Array<{ key: keyof EnvStatus; label: string; env: string }> = [
  { key: "gmi", label: "GMI (LLM provider)", env: "GMI_API_KEY" },
  { key: "daytona", label: "Daytona (sandbox)", env: "DAYTONA_API_KEY" },
];

function curlFor(env: string): string {
  // One-line copyable curl. The key value is intentionally a placeholder
  // (`replace-me`) — the user pastes their real key into the editor before
  // running it. We never echo the actual key value.
  return `curl -fsSL https://recap.dev/install-key | bash -s -- --set ${env}=replace-me`;
}

export function EnvBanner({
  status,
  onCopy,
  pollMs = 15_000,
  onPoll,
}: {
  status: EnvStatus;
  onCopy: (keyName: string) => Promise<boolean> | boolean;
  /** Default 15 s — the P9 fix. The earlier 5 s caused perceptible flicker. */
  pollMs?: number;
  /** Test hook: called once per poll so the cadence test can assert timing. */
  onPoll?: () => void;
}) {
  // Polling + on-focus refresh. The parent owns the actual status; this
  // component just signals "go check again". We use a self-rescheduling
  // setTimeout rather than setInterval so the next poll is scheduled
  // *after* the current one completes — this avoids the strict-mode
  // double-mount race that would otherwise produce two overlapping
  // intervals in tests.
  useEffect(() => {
    if (!onPoll) return;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      onPoll();
      timeoutId = setTimeout(tick, pollMs);
    };
    let timeoutId: ReturnType<typeof setTimeout> = setTimeout(tick, pollMs);
    const onFocus = () => onPoll();
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      clearTimeout(timeoutId);
      window.removeEventListener("focus", onFocus);
    };
  }, [onPoll, pollMs]);

  const missing = MISSING_KEY.filter((k) => !status[k.key]);
  if (missing.length === 0) return null;
  const daytonaMissing = !status.daytona;

  return (
    <div
      data-testid="env-banner"
      className="w-full border-b border-[var(--warn)] bg-[var(--panel-2)] px-4 py-2 text-sm flex items-center gap-3"
      role="status"
    >
      <span className="font-medium">Missing keys:</span>
      {missing.map((k) => (
        <span key={k.env} data-testid={`env-banner-key-${k.key}`} className="font-mono">
          {k.label}
        </span>
      ))}
      {daytonaMissing && (
        <span
          data-testid="env-banner-sandbox-badge"
          className="rounded border border-[var(--warn)] px-2 py-0.5 text-xs"
        >
          Sandbox preview
        </span>
      )}
      <code
        data-testid="env-banner-curl"
        className="ml-auto rounded bg-[var(--panel)] px-2 py-1 text-xs font-mono overflow-x-auto"
      >
        {curlFor(missing[0]!.env)}
      </code>
      <button
        type="button"
        data-testid="env-banner-copy"
        className="rounded border border-[var(--border)] px-2 py-1 text-xs"
        onClick={() => onCopy(missing[0]!.env)}
      >
        Copy
      </button>
    </div>
  );
}
