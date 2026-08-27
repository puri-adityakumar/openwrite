// Phase 3.2 — claim row shape (shared by the API + the Claims tab).
//
// The shape mirrors the `claims` table columns. The seed claims are
// written by seed.sql; live claims are inserted by the TrueForge
// agent's extract step (Phase 4 wires that; today the seed is the
// only source).

export type Claim = {
  id: string;
  text: string;
  evidence: string | null;
  confidence: number | null;
  page: number | null;
  authors: string[] | null;
};
