"use client";

// Phase 1.3 — landing page (auth-split). The client component owns the
// email/password state and posts to /api/auth/login. On success it
// navigates to /dashboard; on failure it shows the neutral "Invalid
// credentials" copy the plan requires.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 max-w-5xl mx-auto">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Recap</h1>
        <p className="mt-4 text-[var(--muted)]">
          Drop a paper.<br />
          Watch an agent dissect it for you.
        </p>
        <p className="mt-6 text-sm leading-6">
          Dr. K reads 40 preprints a week.<br />
          9h &rarr; 47 min.<br />
          2 sends blocked.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold">Sign in</h2>
        <form onSubmit={onSubmit} className="mt-3 space-y-3 max-w-sm">
          <label className="block">
            <span className="text-sm text-[var(--muted)]">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              aria-label="Email"
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm text-[var(--muted)]">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              aria-label="Password"
              className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p className="text-sm text-[var(--bad)]" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Need an account? <a href="/api/auth/signup" className="underline">Create one</a>
        </p>
        <p className="mt-6 text-sm font-mono text-[var(--muted)]">
          demo@local / demo1234
        </p>
      </section>
    </div>
  );
}
