// Render landing page screenshots at desktop / tablet / mobile,
// light + dark. Used to verify the 10x bolder pass.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const OUT = "/tmp/landing-10x-final";
const URL = "http://localhost:13100/";

const viewports = [
  { name: "desktop-light", width: 1440, height: 900, theme: "light" },
  { name: "desktop-dark", width: 1440, height: 900, theme: "dark" },
  { name: "tablet-light", width: 820, height: 1180, theme: "light" },
  { name: "mobile-light", width: 390, height: 844, theme: "light" },
  { name: "mobile-dark", width: 390, height: 844, theme: "dark" },
];

async function snapOne(page, name, theme) {
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("rcp-theme", t);
    } catch (e) {}
  }, theme);
  await page.goto(URL, { waitUntil: "networkidle" });
  // Scroll the entire page top-to-bottom so every IntersectionObserver
  // fires and every <Reveal> receives its is-revealed class before the
  // fullPage screenshot is taken.
  await page.evaluate(async () => {
    const total = document.documentElement.scrollHeight;
    const step = window.innerHeight * 0.7;
    for (let y = 0; y <= total; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  // Wait long enough for count-up + signature wipe to settle.
  await page.waitForTimeout(2500);

  // Full page
  const fullPath = `${OUT}/${name}.png`;
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`✓ ${name} → ${fullPath}`);

  // Per-section (only desktop-light for triage)
  if (name === "desktop-light") {
    const sections = ["signin", "surfaces", "gates", "receipt", "open-cockpit"];
    for (const id of sections) {
      await page.evaluate((sid) => {
        document.getElementById(sid)?.scrollIntoView({ block: "start" });
      }, id);
      await page.waitForTimeout(1100);
      const sectionPath = `${OUT}/section-${id}.png`;
      await page.screenshot({ path: sectionPath, fullPage: false });
      console.log(`  ↳ ${id} → ${sectionPath}`);
    }
  }
}

(async () => {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  for (const v of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 2,
    });
    const page = await ctx.newPage();
    await snapOne(page, v.name, v.theme);
    await ctx.close();
  }
  await browser.close();
  console.log("\nAll snapshots written to", OUT);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});