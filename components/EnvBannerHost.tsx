"use client";

// Phase 3.3 — EnvBannerHost: the layout-level client component that
// owns the env-status fetch + 15s + on-focus polling, and renders the
// EnvBanner at the top of every page. Kept separate from EnvBanner so
// the banner itself stays a pure presentational component (testable
// in isolation, no fetch).

import { useEffect, useState, useCallback } from "react";
import { EnvBanner, type EnvStatus } from "./env-banner";

export function EnvBannerHost() {
  const [status, setStatus] = useState<EnvStatus>({ gmi: true, daytona: true });

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/env-status", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { ok: boolean; status: EnvStatus };
      if (data.ok) setStatus(data.status);
    } catch {
      // Network blip; keep the last known status. The next poll will
      // re-attempt; the banner never flickers because we only update
      // when the server returns a fresh value.
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const onCopy = useCallback(async (keyName: string): Promise<boolean> => {
    try {
      // The curl command is rendered in the banner; we just copy the
      // curl text (not the real key) so the user can paste + edit.
      const code = document.querySelector('[data-testid="env-banner-curl"]') as HTMLElement | null;
      if (!code) return false;
      const text = code.textContent ?? "";
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  return (
    <EnvBanner
      status={status}
      onCopy={onCopy}
      pollMs={15_000}
      onPoll={fetchStatus}
    />
  );
}
