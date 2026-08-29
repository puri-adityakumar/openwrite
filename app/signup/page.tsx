import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { SignupForm } from "../../components/SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="page py-16 md:py-24">
      <div className="max-w-md mx-auto">
        <span className="rcp-eyebrow">
          <span className="rcp-eyebrow-dot" aria-hidden="true" />
          Step 1 of 1
        </span>
        <h1 className="mt-6 text-3xl">Create an account</h1>
        <p className="mt-3 text-base">
          Openwrite runs a single deterministic pipeline on any paper you point it at. You
          decide what gets executed. The agent asks before anything irreversible.
        </p>
        <div className="card mt-8">
          <SignupForm />
        </div>
        <p className="mt-5 text-sm text-[var(--color-muted-foreground)]">
          Already have an account? <a href="/">Sign in</a>
        </p>
      </div>
    </div>
  );
}
