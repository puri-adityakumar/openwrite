// Phase 1.2 — minimal Next.js root layout. The full landing-page UI lands
// in Phase 1.3. This layout just gives the dev server a render target so
// /api/auth/* routes type-check and Playwright can hit a real server.

import type { ReactNode } from "react";

export const metadata = {
  title: "Recap",
  description: "Research-paper autopsy on TrueForge",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
