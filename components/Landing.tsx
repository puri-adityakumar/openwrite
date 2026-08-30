// Landing page composition. Five editorial sections + paper-title
// marquee band + brand footer. The hero sign-in card anchors the
// CTA in CtaSection via id="signin".
//
// "use client" because Hero needs useState/useTransition for the form.
// The four lower sections are server components and compose into the
// same client tree without re-rendering cost.

"use client";

import { BrandFooter } from "./BrandFooter";
import {
  Hero as HeroSection,
  SurfacesSection,
  GatesSection,
  ReceiptSection,
  CtaSection,
} from "./landing/sections";
import { PaperMarquee } from "./landing/motion/PaperMarquee";

export function Landing() {
  return (
    <>
      {/* Section I — Hero. The sign-in anchor the CTA targets. */}
      <div id="signin">
        <HeroSection />
      </div>

      {/* Section II — Six surfaces. Transparent band. */}
      <SurfacesSection />

      {/* Paper-title marquee — the band between Surfaces and Gates. */}
      <PaperMarquee />

      {/* Section III — Three approval gates. Muted band. */}
      <GatesSection />

      {/* Section IV — The receipt. Transparent band. */}
      <ReceiptSection />

      {/* Section V — Final CTA. Inverted panel. */}
      <CtaSection />

      <BrandFooter />
    </>
  );
}