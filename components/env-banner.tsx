"use client";

import { useEffect } from "react";
import { Pill } from "./Pill";

export type EnvStatus = { gmi: boolean; daytona: boolean };

const MISSING_KEY: Array<{ key: keyof EnvStatus; label: string; env: string }> = [
  { key: "gmi", label: "GMI (LLM provider)", env: "GMI_API_KEY" },
  { key: "daytona", label: "Daytona (sandbox)", env: "DAYTONA_API_KEY" },
];

function curlFor(env: string): string {
  return `curl -fsSL https://openwrite.dev/install-key | bash -s -- --set ${env}=replace-me`;
}

export function EnvBanner({
  status,
  onCopy,
  pollMs = 15_000,
  onPoll,
}: {
  status: EnvStatus;
  onCopy: (keyName: string) => Promise<boolean> | boolean;
  pollMs?: number;
  onPoll?: () => void;
}) {
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
      className="w-full border-b bg-[var(--color-secondary)] px-4 py-2 text-sm flex items-center gap-3 flex-wrap"
      style={{ borderColor: "var(--warn)" }}
      role="status"
    >
      <Pill tone="warn" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
        <span className="rcp-eyebrow-dot" style={{ background: "var(--warn)" }} aria-hidden="true" />
        Missing keys
      </Pill>
      {missing.map((k) => (
        <span key={k.env} data-testid={`env-banner-key-${k.key}`} className="font-mono text-xs text-[var(--color-foreground)]">
          {k.label}
        </span>
      ))}
      {daytonaMissing && (
        <Pill tone="warn" data-testid="env-banner-sandbox-badge" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
          Sandbox preview
        </Pill>
      )}
      <code
        data-testid="env-banner-curl"
        className="ml-auto rounded bg-[var(--color-card)] px-2 py-1 text-xs font-mono overflow-x-auto text-[var(--color-foreground)]"
      >
        {curlFor(missing[0]!.env)}
      </code>
      <button
        type="button"
        data-testid="env-banner-copy"
        className="btn-tiny"
        onClick={() => onCopy(missing[0]!.env)}
      >
        Copy
      </button>
    </div>
  );
}
