"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function BrandHeader() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") return attr;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [mounted, setMounted] = useState(false);

  useIsoLayoutEffect(() => {
    setMounted(true);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem("rcp-theme", next); } catch {}
    setTheme(next);
  }

  return (
    <header className="border-b border-[var(--color-border)] backdrop-blur-sm bg-[var(--color-background)]/95"
      style={{ paddingInlineStart: "max(1.5rem, env(safe-area-inset-left))", paddingInlineEnd: "max(1.5rem, env(safe-area-inset-right))" }}
    >
      <div className="max-w-[80rem] mx-auto flex items-center justify-between py-3">
        <a href="/" className="flex items-center gap-2 no-underline">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-6 h-6 rounded bg-[var(--color-foreground)] text-[var(--color-background)] font-heading font-bold text-sm"
          >
            O
          </span>
          <span className="font-heading font-semibold tracking-tight text-[var(--color-foreground)]">
            Openwrite
          </span>
        </a>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/OnSyncLabs/Openwrite"
            className="text-xs text-[var(--color-muted-foreground)] no-underline hover:underline"
          >
            GitHub
          </a>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="btn btn-secondary"
            style={{ minHeight: 44, padding: "0.5rem 0.875rem" }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
