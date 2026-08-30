// Signup page — unified 10x bolder treatment.
// Left two-thirds is the feature panel (Fraunces headline,
// Trail pipeline with indigo Verify, Approval hold-progress,
// receipt stats). Right one-third is the signup card. Server
// component; the card subtree is client because it owns the
// password-strength state and indigo focus ring.

import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { FeaturesPanel } from "../../components/signup/FeaturesPanel";
import { SignupCard } from "../../components/signup/SignupCard";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="page-wide py-12 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-16 items-start">
        <div className="md:col-span-7 lg:col-span-8 order-2 md:order-1">
          <FeaturesPanel />
        </div>
        <div className="md:col-span-5 lg:col-span-4 order-1 md:order-2">
          <SignupCard />
        </div>
      </div>
    </div>
  );
}