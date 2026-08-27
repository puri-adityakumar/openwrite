// Phase 1.3 — /signup page. Linked from the landing "Create one" anchor
// (Qodo bug 3 in PR #5: the link was pointing at /api/auth/signup which
// only accepts POST). Owns the email + password form and posts to the
// existing /api/auth/signup API. On success the cookie is set by the
// API and we navigate to /dashboard.

import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { SignupForm } from "../../components/SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-semibold">Create an account</h1>
      <SignupForm />
      <p className="mt-4 text-sm text-[var(--muted)]">
        Already have an account? <a href="/" className="underline">Sign in</a>
      </p>
    </div>
  );
}
