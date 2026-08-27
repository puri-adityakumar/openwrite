"use client";

// Phase 1.3 — /signup client form. Mirrors Landing's sign-in form but
// posts to /api/auth/signup. On success the API sets the session
// cookie; we navigate to /dashboard.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setError("Invalid credentials");
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
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
        <span className="text-sm text-[var(--muted)]">Password (8+ chars)</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-label="Password"
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      {error && (
        <p className="text-sm text-[var(--bad)]" role="alert">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-[var(--accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
