// Phase 1.2 — minimal landing. The full design lands in Phase 1.3.
// This page exists so `next dev` has a renderable root and the E2E guard
// redirect (unauthenticated /dashboard -> /) has a real / to land on.

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main>
      <h1>Recap</h1>
      <p>Phase 1.2 minimal shell. Full landing lands in Phase 1.3.</p>
    </main>
  );
}
