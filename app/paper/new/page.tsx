import { requireUser } from "../../../lib/session";
import { NewPaperForm } from "../../../components/NewPaperForm";

export const dynamic = "force-dynamic";

export default async function NewPaperPage() {
  await requireUser();
  return (
    <div className="page py-10 md:py-14">
      <div className="max-w-2xl">
        <h1 className="text-3xl md:text-4xl">What are we reading?</h1>
        <NewPaperForm />
      </div>
    </div>
  );
}