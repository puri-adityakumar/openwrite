// Global navbar — sticky, frosted glass over the page. Logo on the
// left, GitHub + theme toggle + (when signed in) logout on the right.
// No center nav: this app is task-shaped, not marketing-shaped, so a
// row of placeholder links adds noise. Color and font tokens come from
// app/globals.css; nothing hardcoded here.

"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { Logo } from "./landing/Logo";
import { LogoutButton } from "./LogoutButton";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function BrandHeader({ signedInEmail }: { signedInEmail?: string | null } = {}) {
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
        <Logo size={28} mark={false} />

        <div className="flex items-center gap-2">
          <a
            href="https://github.com/puri-adityakumar/openwrite"
            aria-label="GitHub repository"
            title="GitHub repository"
            className="navbar-icon-btn"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2.04c-3.2.69-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.4-5.26 5.69.41.36.78 1.06.78 2.13v3.16c0 .31.21.68.8.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </a>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="navbar-icon-btn"
          >
            {theme === "dark" ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
              </svg>
            )}
          </button>
          {signedInEmail && <LogoutButton email={signedInEmail} />}
        </div>
      </div>
    </header>
  );
}
