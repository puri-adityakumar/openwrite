// Landing page section composition barrel.
// Imported by /components/Landing.tsx.
//
// Side-effect import below registers landing.css with the bundler
// once. All section components plus the editorial primitives
// (SectionRule, Reveal) are re-exported so Landing.tsx can compose
// the whole page from a single import.

import "./landing.css";

export { Hero } from "./Hero";
export { SurfacesSection } from "./SurfacesSection";
export { GatesSection } from "./GatesSection";
export { ReceiptSection } from "./ReceiptSection";
export { CtaSection } from "./CtaSection";

export { SectionRule } from "./SectionRule";
export { Reveal } from "./Reveal";