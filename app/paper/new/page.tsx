// Phase 1.3 — /paper/new. Guarded. Renders the source input + 3-mode
// dial per the mockup. Submitting POSTs to /api/agent/start which is
// not yet wired in Phase 1.3, so the form returns a 501 with a clear
// message ("Agent wiring lands in Phase 2"). The dial is fully usable
// client-side; Review is the default per the plan.

import { requireUser } from "../../../lib/session";
import { NewPaperForm } from "../../../components/NewPaperForm";

export const dynamic = "force-dynamic";

export default async function NewPaperPage() {
  await requireUser();
  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold">New Paper</h1>
      <NewPaperForm />
    </div>
  );
}
