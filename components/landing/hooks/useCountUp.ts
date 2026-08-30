// Vanilla count-up tween. requestAnimationFrame, no library.
// Returns a ref the caller attaches to the observed element and
// the current value.
//
// Triggers when the element first scrolls past `threshold` (default
// 0.5 of viewport). Snap-to-final on scroll-past: if the user scrolls
// past the trigger before the animation completes, the count jumps
// to the final value rather than freezing at an intermediate.
//
// Reduced-motion: skips the tween, returns the final value on the
// first effect tick.

"use client";

import { useEffect, useRef, useState } from "react";

type UseCountUpOptions = {
  to: number;
  durationMs?: number;
  threshold?: number;
  decimals?: number;
};

export function useCountUp({
  to,
  durationMs = 1100,
  threshold = 0.1,
  decimals = 0,
}: UseCountUpOptions) {
  const ref = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setValue(to);
      return;
    }

    let raf = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || startedRef.current) continue;
          startedRef.current = true;

          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / durationMs, 1);
            const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
            const next = eased * to;
            setValue(decimals > 0 ? Number(next.toFixed(decimals)) : next);
            if (t < 1) raf = requestAnimationFrame(tick);
            else setValue(to);
          };
          raf = requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, durationMs, threshold, decimals]);

  return { ref, value };
}

export type CountUpHandle = ReturnType<typeof useCountUp>;