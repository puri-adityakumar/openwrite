import { requireUser } from "../../../lib/session";
import { NewPaperForm } from "../../../components/NewPaperForm";

export const dynamic = "force-dynamic";

export default async function NewPaperPage() {
  await requireUser();
  return (
    <div className="page py-10 md:py-14">
      <div className="max-w-3xl">
        <span className="rcp-eyebrow">New run</span>
        <h1 className="mt-3 text-3xl md:text-4xl">Drop a paper</h1>
        <p className="mt-3 text-base">
          Paste an arXiv URL or a local PDF path, then pick a verb. The agent
          runs the full pipeline and asks for explicit allow before any
          irreversible step.
        </p>
        <NewPaperForm />
      </div>
    </div>
  );
}
