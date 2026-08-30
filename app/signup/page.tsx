// Signup redesign scaffold — feature panel + signup card land next.
// See docs/signup-redesign-plan.md for the section plan.

import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return null;
}