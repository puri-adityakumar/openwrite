// Editorial hero — Lane 1 of the landing redesign.
// See docs/landing-redesign-plan.md for the section plan; this file
// owns the kicker, headline, deck, trail pills, cockpit figure, and
// the sign-in card on the right.

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "../Pill";

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
    <section className="page-wide grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12 py-16 md:py-24 items-start">
      <div className="md:col-span-7 animate-fade-in">
        <span className="rcp-eyebrow mt-6">
          <span className="rcp-eyebrow-dot" aria-hidden />
          Now in private alpha
        </span>

        <h1
          className="mt-8 text-[clamp(2.75rem,6vw,5.5rem)] font-light leading-[1.04] tracking-[-0.04em]"
          style={{ fontFamily: "var(--font-heading)", fontWeight: 300 }}
        >
          Recap
          <br />
          is the receipt for a paper you have to read.
        </h1>

        <p
          className="mt-6 max-w-xl text-[1.125rem] leading-relaxed"
          style={{ fontFamily: "var(--font-heading)", color: "var(--color-muted-foreground)" }}
        >
          Forty pages. Two hours. The week doesn&apos;t have it.
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          <Pill tone="idle">Source</Pill>
          <Pill tone="idle">Parse</Pill>
          <Pill tone="good">Extract</Pill>
          <Pill tone="good">Score</Pill>
          <Pill tone="warn" data-state="running">Verify</Pill>
          <Pill tone="good">Done</Pill>
        </div>

        <figure className="mt-10 animate-fade-in" style={{ animationDelay: "300ms" }}>
          <a href="/screenshots/cockpit-first-paint.png" target="_blank" rel="noreferrer">
            <img
              src="/screenshots/cockpit-first-paint.png"
              alt="Recap cockpit, first paint"
              width={1200}
              height={750}
              className="cockpit-frame block w-full max-h-[26rem] object-cover object-top rounded-lg border border-[var(--color-foreground)]/50 shadow-sm hover:shadow-md transition-shadow duration-300"
            />
          </a>
          <figcaption
            className="mt-2 text-[0.75rem]"
            style={{ fontFamily: "var(--font-heading)", fontWeight: 500, color: "var(--color-muted-foreground)" }}
          >
            Open full size ↗
          </figcaption>
        </figure>
      </div>

      <div className="md:col-span-5 animate-slide-in">
        <div className="card">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-heading)" }}>
            Sign in
          </h2>
          <p className="mt-1 text-sm">Continue to your paper runs.</p>

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
              className="btn btn-primary w-full justify-center"
            >
              {pending && <span className="btn-spinner" aria-hidden />}
              {pending ? "Signing in" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm">
            Need an account? <a href="/signup">Create one</a>
          </p>

          <p className="mt-6 font-mono text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            demo@local / demo1234
          </p>
        </div>
      </div>
    </section>
  );
}