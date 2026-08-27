// Phase 1.3 + 3.3 — root layout: imports Tailwind globals, renders the
// top header (Recap brand + power-user footer "Powered by ..."), wraps
// every page, and mounts the global EnvBanner.

import type { ReactNode } from "react";
import "./globals.css";
import { EnvBannerHost } from "../components/EnvBannerHost";

export const metadata = {
  title: "Recap",
  description: "Drop a paper. Watch an agent dissect it for you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <EnvBannerHost />
        <header className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
          <a href="/" className="font-semibold tracking-tight">Recap</a>
          <span className="text-xs text-[var(--muted)]">
            Powered by TrueForge · Daytona · GMI · Qodo
          </span>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
