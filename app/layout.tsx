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
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme = stored || system;
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
          href="https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&family=Merriweather:wght@300;400;700&display=swap"
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
