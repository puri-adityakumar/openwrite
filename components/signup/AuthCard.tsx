"use client";

// AuthCard — the right 1/3 of /auth. No card chrome: no border,
// no shadow, no padding around it. The column does the framing via
// a full-length vertical hairline on its left edge (the signature
// element: one indigo pulse on mount, then quiet); that rule and
// the sticky/centred positioning are owned by the aside in
// app/auth/page.tsx.
//
// Demo credentials are printed as a one-line mono note beneath the
// form so a judge can type them in directly. No chip, no disclosure,
// no one-click handler — keep the surface flat.

import { useState } from "react";
import { LoginForm } from "../LoginForm";
import { SignupForm } from "../SignupForm";
import { Logo } from "../landing/Logo";
import "./signup.css";

type Tab = "signup" | "signin";

const TABS: { id: Tab; label: string }[] = [
  { id: "signup", label: "Create account" },
  { id: "signin", label: "Sign in" },
];

export const DEMO_EMAIL = "demo@local";
export const DEMO_PASSWORD = "demo1234";

export function AuthCard() {
  const [tab, setTab] = useState<Tab>("signin");

  return (
    <div className="pl-6 md:pl-8">
      {/* Top: brand mark. */}
      <div className="mb-6">
        <Logo size={26} mark={false} />
      </div>

      <h2
        className="text-[1.5rem] leading-tight tracking-[-0.025em]"
        style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
      >
        {tab === "signup" ? "Create an account" : "Sign in"}
      </h2>
      {tab === "signin" && (
        <p
          className="mt-1.5 text-sm"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          Continue to your paper runs.
        </p>
      )}

      {/* Tab switch — regular email/password only. */}
      <div
        className="mt-6 grid grid-cols-2 gap-1 p-1 rounded-lg"
        style={{ background: "var(--color-border)" }}
        role="tablist"
        aria-label="Auth method"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="rounded-md text-sm font-medium transition-colors duration-200"
            style={{
              padding: "0.5rem 0",
              background: tab === t.id ? "var(--color-card)" : "transparent",
              color: tab === t.id ? "var(--color-foreground)" : "var(--color-muted-foreground)",
              fontFamily: "var(--font-body)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "signup" ? <SignupForm /> : <LoginForm />}
      </div>

      {/* Demo credentials — one-line mono note. No button, no panel,
          no disclosure state. A judge types the two strings in. */}
      <p
        className="mt-6 text-xs font-mono"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Demo: <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>{DEMO_EMAIL}</span> / {DEMO_PASSWORD}
      </p>
    </div>
  );
}