// 10x Bolder Hero. Asymmetric 6 / -1 / 5 floating grid where the
// sign-in card overlaps the cockpit figure by ~120px on desktop.
// "Recap" renders in Fraunces 500 + indigo with an animated accent
// underline; the rest of the h1 word-fades up via CSS keyframes.
// Cockpit frame gets a soft indigo glow (the one place we allow
// it). Trail pills animate a connected flow dot across them.

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "../Pill";
import { HeroHeadline, SignatureBeat } from "./motion/SignatureBeat";

const TRAIL = [
  { label: "Source", tone: "idle" as const },
  { label: "Parse", tone: "idle" as const },
  { label: "Extract", tone: "good" as const },
  { label: "Score", tone: "good" as const },
  { label: "Verify", tone: "warn" as const, running: true },
  { label: "Done", tone: "good" as const },
];

export function Hero() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError("Invalid credentials");
      }
    });
  }

  return (
    <section className="page-wide grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 py-16 md:py-24 relative overflow-hidden">
      {/* Hero gradient backdrop — soft receipt gradient over the page. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{ background: "var(--receipt-grad)" }}
      />

      {/* Column 1–6: hero copy + cockpit figure. */}
      <div className="md:col-span-7 animate-fade-in relative">
        <span className="rcp-eyebrow mt-2">
          <span className="rcp-eyebrow-dot" aria-hidden />
          Now in private alpha
        </span>

        <div className="mt-6 max-w-4xl">
          <HeroHeadline
            lead="Recap"
            rest="is the receipt for a paper you have to read."
          />
          <SignatureBeat />
        </div>

        <p
          className="mt-7 max-w-xl text-[1.0625rem] leading-[1.6]"
          style={{
            fontFamily: "var(--font-heading)",
            color: "var(--color-muted-foreground)",
          }}
        >
          Forty pages. Two hours. The week doesn&apos;t have it. Recap runs
          one deterministic pipeline on any preprint or PDF, asks before
          anything irreversible, and hands you the receipt.
        </p>

        {/* Connected trail pills — a moving dot ties them together. */}
        <div className="mt-8 relative">
          <div
            aria-hidden="true"
            className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
            style={{ background: "var(--color-foreground)/10" }}
          />
          <div
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
            style={{
              background: "var(--accent-indigo)",
              boxShadow: "0 0 0 4px var(--accent-indigo-soft)",
              animation: "rcp-trail-flow 8s linear infinite",
            }}
          />
          <div className="relative flex flex-wrap gap-2 py-1">
            {TRAIL.map((t) => (
              <Pill key={t.label} tone={t.tone} data-state={t.running ? "running" : undefined}>
                {t.label}
              </Pill>
            ))}
          </div>
        </div>

        {/* Cockpit figure — receives the indigo glow budget. */}
        <figure className="mt-12 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <a
            href="/screenshots/cockpit-first-paint.png"
            target="_blank"
            rel="noreferrer"
            className="block rcp-cockpit-glow rounded-xl overflow-hidden border"
            style={{ borderColor: "var(--color-border)", outlineOffset: 4 }}
          >
            <div className="rcp-signature-wipe">
              <img
                src="/screenshots/cockpit-first-paint.png"
                alt="Recap cockpit, first paint"
                width={1200}
                height={750}
                className="cockpit-frame block w-full max-h-[26rem] object-cover object-top rounded-xl"
              />
            </div>
          </a>
          <figcaption
            className="mt-2 text-[0.75rem] flex items-center gap-2"
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 500,
              color: "var(--color-muted-foreground)",
            }}
          >
            Open full size
            <span aria-hidden="true">↗</span>
          </figcaption>
        </figure>
      </div>

      {/* Column 7–11: sign-in card, FLOATING over the cockpit figure. */}
      <div
        className="md:col-span-5 md:col-start-8 md:-translate-y-10 animate-slide-in"
        style={{ animationDelay: "500ms" }}
      >
        <div
          className="card relative"
          style={{
            background: "var(--color-card)",
            boxShadow:
              "0 0 0 1px var(--color-border), 0 0 24px -8px var(--accent-indigo-soft), 0 30px 60px -30px hsl(243 75% 58% / 0.18)",
          }}
        >
          <h2
            className="text-xl"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 600 }}
          >
            Sign in
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            Continue to your paper runs.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                aria-label="Email"
                placeholder="Email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="sr-only">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                aria-label="Password"
                placeholder="Password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && (
              <p
                role="alert"
                className="text-sm"
                style={{ color: "var(--color-destructive)" }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="btn btn-indigo w-full justify-center"
            >
              {pending && <span className="btn-spinner" aria-hidden />}
              {pending ? "Signing in" : "Sign in to the cockpit"}
            </button>

            <button
              type="button"
              aria-disabled="true"
              disabled
              className="btn w-full justify-center"
              style={{
                background: "transparent",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
              }}
            >
              Continue with Google
            </button>
          </form>

          <details className="mt-6 group">
            <summary
              className="cursor-pointer text-xs font-heading uppercase tracking-[0.08em]"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Why an account?
            </summary>
            <p
              className="mt-2 text-xs"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              Demo creds below for the seeded run. We never train on your runs.
            </p>
          </details>

          <p
            className="mt-4 font-mono text-xs"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            demo@local / demo1234
          </p>
        </div>
      </div>
    </section>
  );
}