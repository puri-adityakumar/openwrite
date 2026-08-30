// Landing page composition. Five editorial sections plus a brand footer.
// The hero sign-in card anchors the CTA in CtaSection via id="signin".
// See docs/landing-redesign-plan.md for the section rationale.
//
// "use client" because Hero needs useState/useTransition for the form.
// The four lower sections are server components and compose into the
// same client tree without re-rendering cost.

"use client";

import { BrandFooter } from "./BrandFooter";
import {
  Hero,
  SurfacesSection,
  GatesSection,
  ReceiptSection,
  CtaSection,
} from "./landing/sections";

export function Landing() {
  return (
    <>
      {/* Section I — Hero. The sign-in anchor the CTA targets. */}
      <div id="signin">
        <Hero />
      </div>

      {/* Section II — Six surfaces. Transparent band. */}
      <SurfacesSection />

      {/* Section III — Three approval gates. Muted band. */}
      <GatesSection />

      {/* Section IV — The receipt. Transparent band. */}
      <ReceiptSection />

      {/* Section V — Final CTA. Muted band. */}
      <CtaSection />

      <BrandFooter />
    </>
  );
}