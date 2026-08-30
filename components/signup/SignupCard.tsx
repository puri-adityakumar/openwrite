"use client";

// SignupCard — the right-1/3 column of the redesigned /signup.
// Wraps the existing <Form>SignupForm</Form> in a sticky .card with a
// brand mark, "Step 1 of 1" badge, copy, an OAuth placeholder row
// (GitHub, not wired), and a sign-in footer link. The OAuth button is
// purely visual until the flow ships; the design system owns the
// button chrome via .btn .btn-secondary, so this stays in sync with
// every other secondary action in the app.

import { SignupForm } from "../SignupForm";
import { Logo } from "../landing/Logo";
import "./signup.css";

export function SignupCard() {
  return (
    <div className="card signup-card-hoverable p-7 md:p-8 sticky top-24">
      {/* Top: brand mark + a small "Step 1 of 1" badge so the form
          reads as a single intentional surface, not a generic widget.
          The badge uses the kicker class (Raleway 600 caps) so it
          shares typography with the OPENWRITE RECAP pill on the left,
          not the system-ui Pill component. */}
      <div className="flex items-center justify-between mb-6">
        <Logo size={26} />
        <span className="rcp-eyebrow">
          <span className="rcp-eyebrow-dot" aria-hidden="true" />
          Step 1 of 1
        </span>
      </div>

      <h2
        className="text-[1.5rem] leading-tight tracking-[-0.025em]"
        style={{ fontFamily: "var(--font-heading)", fontWeight: 500 }}
      >
        Create an account
      </h2>
      <p
        className="mt-1.5 text-sm"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Two fields. No credit card.
      </p>

      <div className="mt-6">
        <SignupForm />
      </div>

      {/* Divider — the visual seam between the email/password form
          and the social options row. Uppercase tracked "or" sits in
          the same muted-foreground color as the helper copy above. */}
      <div className="my-6 flex items-center gap-3">
        <div
          className="flex-1 h-px"
          style={{ background: "var(--color-border)" }}
        />
        <span
          className="text-[0.75rem] uppercase tracking-[0.18em] font-medium"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          or
        </span>
        <div
          className="flex-1 h-px"
          style={{ background: "var(--color-border)" }}
        />
      </div>

      {/* GitHub social row — PLACEHOLDER. No onClick, no OAuth wiring;
          aria-label is explicit so the placeholder status reaches
          assistive tech without a visual footnote. */}
      <button
        type="button"
        aria-label="Continue with GitHub (placeholder)"
        className="btn btn-secondary w-full justify-center"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 .5C5.4.5 0 5.9 0 12.5c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2c-3.3.7-4.1-1.6-4.1-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.3-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2 1-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.9 1.2 2 1.2 3.3 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.8-1.6 8.2-6.1 8.2-11.4C24 5.9 18.6.5 12 .5z" />
        </svg>
        <span>Continue with GitHub</span>
      </button>

      <p
        className="mt-6 text-sm text-center"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Already have an account? <a href="/">Sign in</a>
      </p>
    </div>
  );
}