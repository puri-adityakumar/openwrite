// /auth — split-asymmetric layout, 2:1.
//
// Left two-thirds is the editorial pitch (FeaturesPanel). It scrolls
// past three sections — headline + pull-quote, the Trail pipeline,
// Approval gate, plus two more blocks that arrive on scroll so the
// column has more vertical real estate than the viewport.
//
// Right one-third is the credential surface (AuthCard). It is
// unpinned from a card chrome — no border, no shadow, no padding —
// and rides in a sticky wrapper so it stays centred between the
// navbar and the viewport edge while the left column scrolls. The
// vertical hairline on the column's left edge is the signature
// gesture; it runs the full length of the page, and one indigo
// pulse on mount, then quiet.
//
// Server component; the card subtree is client because it owns
// the tab state, password-strength state and the focus ring.

import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { FeaturesPanel } from "../../components/signup/FeaturesPanel";
import { AuthCard } from "../../components/signup/AuthCard";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");
  return (
    <div className="page-wide py-12 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16">
        <div className="md:col-span-2 order-2 md:order-1 min-w-0">
          <FeaturesPanel />
        </div>
        <aside className="md:col-span-1 order-1 md:order-2 relative min-w-0 md:-my-20 md:py-20">
          {/* Signature hairline — full length of the page. The aside
              borrows back the page's vertical padding (negative
              margin, mirrored padding inside) so the rule runs from
              directly under the navbar to the bottom of the content
              with no gap. Decorative only; aria-hidden so it does
              not interrupt the tablist semantics inside the card. */}
          <span
            aria-hidden
            className="auth-pane-rule absolute left-0 top-0 bottom-0 w-px"
          />
          {/* Sticky + vertically centred: the wrapper is exactly the
              visible height under the sticky navbar, so centring the
              card in it centres the card in the viewport too. */}
          <div className="md:sticky md:top-16 md:min-h-[calc(100vh-4rem)] md:flex md:flex-col md:justify-center">
            <AuthCard />
          </div>
        </aside>
      </div>
    </div>
  );
}