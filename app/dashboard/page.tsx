// Phase 1.2 — guard target. requireUser() in lib/session.ts redirects
// unauthenticated visitors to /. The full dashboard UI lands in Phase 1.3.

import { requireUser } from "../../lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <main>
      <h1>Dashboard</h1>
      <p>Signed in as {user.email ?? user.sub}. Full UI lands in Phase 1.3.</p>
    </main>
  );
}
