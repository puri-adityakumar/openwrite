"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);

  const passwordOk = password.length >= 8;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // The browser's native validation has already run by the time we
    // get here — invalid fields were focused, valid fields made it
    // through. We add the password-length guard because our client
    // rule is stricter than `minLength={8}` (the rule renders the
    // password strength hint as the user types, not on submit).
    if (!passwordOk) {
      setError("Password must be 8 or more characters.");
      return;
    }
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
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Sign up failed");
    });
  }

  // Format-on-blur for email. Until the field has been blurred, we
  // don't show aria-invalid (a half-typed address is not a fail).
  // Once blurred, we mirror the browser's checkValidity() so the
  // input carries its own red border + the field stays associated
  // with the password hint via aria-describedby.
  function onEmailBlur(e: React.FocusEvent<HTMLInputElement>) {
    setEmailBlurred(true);
    setEmailInvalid(!e.currentTarget.checkValidity());
  }
  function onEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
    setEmail(e.target.value);
    if (emailBlurred) setEmailInvalid(!e.currentTarget.checkValidity());
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
          aria-invalid={emailBlurred && emailInvalid}
          className="input mt-1.5"
          value={email}
          onChange={onEmailChange}
          onBlur={onEmailBlur}
        />
      </label>
      <label className="block">
        <span className="text-sm text-[var(--color-foreground)]">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-label="Password"
          aria-describedby="pw-hint"
          aria-invalid={password.length > 0 && !passwordOk}
          className="input mt-1.5"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p id="pw-hint" className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
          {passwordOk
            ? "Strong enough."
            : "8 or more characters."}
        </p>
      </label>
      {error && (
        <p className="text-sm text-[var(--color-destructive)]" role="alert">{error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn btn-primary w-full justify-center"
      >
        {pending && <span className="btn-spinner" aria-hidden="true" />}
        <span>{pending ? "Creating account" : "Create account"}</span>
      </button>
    </form>
  );
}
