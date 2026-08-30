import type { ReactNode } from "react";
import "./globals.css";
import { EnvBannerHost } from "../components/EnvBannerHost";
import { BrandHeader } from "../components/BrandHeader";
import { getCurrentUser } from "../lib/session";

export const metadata = {
  title: "Openwrite — Drop a paper. Watch an agent dissect it for you.",
  description: "Drop a paper. Watch an agent dissect it for you.",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('rcp-theme');
    var prefersDark = window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    // Priority: localStorage (returning visitor) → OS preference → light default.
    // OS preference is the fallback so dark-mode visitors get a dark first paint.
    var theme = stored || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) { /* SSR safe */ }
})();
`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return (
    // suppressHydrationWarning: the inline themeBootstrap script sets
    // data-theme and colorScheme on <html> before React hydrates so the
    // first paint matches the resolved theme. React would otherwise
    // warn about the mismatch when it re-renders the attribute. The
    // attribute values are safe — the bootstrap is the source of truth.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..600,0..100;1,9..144,300..600,0..100&family=Raleway:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <EnvBannerHost />
        <BrandHeader signedInEmail={user?.email ?? null} />
        <main className="pt-6 md:pt-10">{children}</main>
      </body>
    </html>
  );
}
