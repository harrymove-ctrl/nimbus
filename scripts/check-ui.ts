// UI exit check (run from a normal terminal; needs Chrome via Playwright): at 1024, 1280 and 1440 px wide, the
// element at the RUN button's centre and corners must be the button itself: nothing may sit over a control.
//   NIMBUS_URL=http://localhost:3000 pnpm exec tsx scripts/check-ui.ts   (dev server running, mock mode)
import { chromium } from "playwright";

const BASE = process.env.NIMBUS_URL ?? "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  let failed = 0;
  for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: "dark" });
    await page.goto(BASE);
    await page.locator("nav").first().waitFor({ timeout: 20_000 }).catch(() => {});
    await page.getByText("Checkout conversion drop", { exact: false }).first().click();
    await page.locator("textarea").fill("Why did checkout conversion drop on Oct 14?");
    const run = page.getByRole("button", { name: /^RUN$/ });
    await run.waitFor();
    const hit = await run.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.5, 0.2], [0.5, 0.8]].map(([fx, fy]) => {
        const t = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
        return t === el || el.contains(t);
      });
    });
    const ok = hit.every(Boolean);
    if (!ok) failed++;
    console.log(`${ok ? "✓" : "✗"} ${w}px: RUN button is what the pointer hits at centre and corners`);
    await page.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
}
void main();
