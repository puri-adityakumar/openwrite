"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pill } from "./Pill";

export function Landing() {
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
    <div className="page-wide grid grid-cols-1 md:grid-cols-12 gap-12 py-16 md:py-24 items-start">
      <section className="md:col-span-7 animate-fade-in">
        <span className="rcp-eyebrow">
          <span className="rcp-eyebrow-dot" aria-hidden="true" />
          Now in private alpha
        </span>
        <h1 className="mt-6 max-w-2xl text-4xl md:text-6xl">
          Drop a paper.<br />
          Watch an agent dissect it for you.
        </h1>
        <p className="mt-6 max-w-xl text-lg">
          Openwrite runs a single deterministic pipeline on any preprint or PDF you point
          it at. Source, parse, extract, score, verify, publish. The agent asks
          before it does anything irreversible. You watch the trail and decide.
        </p>

        <div className="mt-10 max-w-xl card">
          <h2 className="text-base">What the agent does</h2>
          <ol className="mt-4 space-y-3 text-sm text-[var(--color-foreground)]">
            <li className="flex items-start gap-3">
              <Pill tone="good" style={{ minWidth: "5rem", justifyContent: "center" }}>
                Source
              </Pill>
              <span className="text-base text-[var(--color-foreground)]">Fetches from arXiv, OpenAlex, or a local PDF path</span>
            </li>
            <li className="flex items-start gap-3">
              <Pill tone="good" style={{ minWidth: "5rem", justifyContent: "center" }}>
                Extract
              </Pill>
              <span className="text-base text-[var(--color-foreground)]">Surfaces every claim with a citation and a confidence</span>
            </li>
            <li className="flex items-start gap-3">
              <Pill tone="warn" style={{ minWidth: "5rem", justifyContent: "center" }}>
                Verify
              </Pill>
              <span className="text-sm text-[var(--color-muted-foreground)]">Asks for your explicit allow before running any sandbox</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="md:col-span-5 animate-slide-in">
        <div className="card">
          <h2 className="text-xl">Sign in</h2>
          <p className="mt-1 text-sm">Continue to your paper runs.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-[var(--color-foreground)]">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                aria-label="Email"
                className="input mt-1.5"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm text-[var(--color-foreground)]">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                aria-label="Password"
                className="input mt-1.5"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <p className="text-sm text-[var(--color-destructive)]" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="btn btn-primary w-full justify-center"
            >
              {pending && <span className="btn-spinner" aria-hidden="true" />}
              <span>{pending ? "Signing in" : "Sign in"}</span>
            </button>
          </form>

          <p className="mt-5 text-sm text-[var(--color-muted-foreground)]">
            Need an account? <a href="/signup">Create one</a>
          </p>
          <p className="mt-2 text-xs text-[var(--color-muted-foreground)] font-mono">
            demo@local / demo1234
          </p>
        </div>
      </section>
    </div>
  );
}
