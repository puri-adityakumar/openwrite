// Global navbar — sticky, frosted glass over the page, Logo on the
// left, four nav links centered, GitHub + theme toggle on the right.
// Pairs with the landing 10x pass (docs/landing-10x-handover.md):
// muted-foreground rest, indigo hover, Montserrat 14px medium.
// Color and font tokens are read from app/globals.css; no hardcoded
// values here.

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Logo } from "./landing/Logo";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const NAV_LINKS = [
  { label: "Recap",    href: "/#surfaces" },
  { label: "Features", href: "/#surfaces" },
  { label: "Pricing",  href: "/#open-cockpit" },
  { label: "Docs",     href: "https://github.com/OnSyncLabs/Openwrite" },
];

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
    <header
      className="sticky top-0 z-50 border-b border-[var(--color-border)] backdrop-blur-md"
      style={{
        background: "color-mix(in srgb, var(--color-background) 78%, transparent)",
        paddingInlineStart: "max(1.5rem, env(safe-area-inset-left))",
        paddingInlineEnd: "max(1.5rem, env(safe-area-inset-right))",
      }}
    >
      <div className="max-w-[80rem] mx-auto flex items-center justify-between gap-6 py-3.5">
        <Logo size={28} />

        <nav className="hidden md:flex items-center gap-7" aria-label="Product">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="navbar-link text-[0.875rem] font-medium no-underline transition-colors duration-200"
              style={{ color: "var(--color-muted-foreground)", fontFamily: "var(--font-body)" }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/OnSyncLabs/Openwrite"
            className="navbar-link text-xs no-underline transition-colors duration-200 hidden sm:inline-block"
            style={{ color: "var(--color-muted-foreground)", fontFamily: "var(--font-body)" }}
          >
            GitHub
          </a>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="btn btn-secondary"
            style={{ minHeight: 40, padding: "0.4rem 0.875rem", fontFamily: "var(--font-body)" }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
