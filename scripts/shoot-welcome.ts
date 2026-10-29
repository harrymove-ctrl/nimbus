// Full-page screenshots of /welcome at 1280 and 390 wide (evidence for the PR), plus a cheap load timing.
//   OUT=docs/landing NIMBUS_URL=http://localhost:3250 node --import tsx scripts/shoot-welcome.ts   (needs Chrome via Playwright; run from a normal terminal)
// Dev tooling only: nothing in src/ imports this.
import { chromium } from "playwright";
const BASE = process.env.NIMBUS_URL ?? "http://localhost:3250";
const OUT = process.env.OUT ?? ".";
async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true }).catch(() => chromium.launch({ headless: true }));
  for (const [w, h] of [[1280, 800], [390, 844]] as const) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: "dark" });
    const t0 = Date.now();
    await page.goto(BASE + "/welcome", { waitUntil: "load" });
    const load = Date.now() - t0;
    await page.waitForTimeout(1200);
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    await page.screenshot({ path: `${OUT}/landing-welcome-${w}.png`, fullPage: true });
    console.log(`${w}px: load ${load} ms, scrollWidth ${scrollW}`);
    await page.close();
  }
  await browser.close();
}
void main();
