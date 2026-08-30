"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(subEmail: string, subPassword: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: subEmail, password: subPassword }),
    });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Invalid credentials");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      await submit(email, password);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="text-sm text-[var(--color-foreground)]">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          aria-label="Email"
          className="input signup-card-input mt-1.5"
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
          className="input signup-card-input mt-1.5"
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
        className="btn btn-indigo w-full justify-center"
      >
        {pending && <span className="btn-spinner" aria-hidden="true" />}
        <span>{pending ? "Signing in" : "Sign in"}</span>
      </button>
    </form>
  );
}