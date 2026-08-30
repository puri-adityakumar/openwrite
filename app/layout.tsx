import type { ReactNode } from "react";
import "./globals.css";
import { EnvBannerHost } from "../components/EnvBannerHost";
import { BrandHeader } from "../components/BrandHeader";

export const metadata = {
  title: "Openwrite — Drop a paper. Watch an agent dissect it for you.",
  description: "Drop a paper. Watch an agent dissect it for you.",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('rcp-theme');
    // Light is the default for new visitors. The OS preference is
    // intentionally ignored so the marketing page first-paints
    // light regardless of OS setting; once the visitor explicitly
    // toggles the theme, localStorage wins.
    var theme = stored || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) { /* SSR safe */ }
})();
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
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
        <BrandHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
