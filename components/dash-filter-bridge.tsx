"use client";

// Filter bridge — the dashboard keeps filter state in the URL hash
// (#waiting) so chip clicks never hit the server. Server components
// can't read the hash, so on mount (and on every hashchange) this
// echoes the hash as ?f= via a replace navigation; the page then
// re-renders with the right filter and the URL stays on /dashboard.
//
// No-op when the hash is empty or matches what ?f= already holds.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const FILTER_IDS = new Set(["all", "waiting", "done", "failed"]);

export function DashFilterBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hydrated = useRef(false);

  useEffect(() => {
    const raw = window.location.hash.replace("#", "");
    if (!FILTER_IDS.has(raw) || raw === "all") {
      hydrated.current = true;
      return;
    }
    // Only echo on first load / external hash change — never on the
    // replace we're about to make (avoids a redirect loop).
    const current = searchParams.get("f");
    if (hydrated.current && current === raw) return;
    hydrated.current = true;
    router.replace(`${pathname}?f=${raw}`);
  }, [pathname, searchParams, router]);

  return null;
}
