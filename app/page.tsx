// Phase 1.3 — landing (auth-split). The mockup puts the Dr. K anchor
// on the left and the sign-in card on the right; demo creds are visible
// under the card (decision D2). Sign-in posts to /api/auth/login and
// redirects to /dashboard on success.

import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/session";
import { Landing } from "../components/Landing";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return <Landing />;
}
