// A4 PNG export and the interface-bts overlap check. Run from a normal terminal (needs headless Chrome):
//   pnpm exec playwright install chromium
//   node docs/posters/export.mjs
// Output: docs/posters/approval-card.png and timeline-strip.png (A4 at 96 dpi × 2 = 1588 × 2246).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const overlaps = path.join(dir, "..", "..", ".agents", "skills", "interface-bts", "scripts", "overlaps.js");
const browser = await chromium.launch();
for (const name of ["approval-card", "timeline-strip"]) {
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await page.goto("file://" + path.join(dir, `${name}.html`));
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
  // The skill's overlap check at its three sizes: it must return nothing.
  await page.addScriptTag({ content: readFileSync(overlaps, "utf8") });
  for (const [w, h] of [[1280, 800], [1000, 760], [1030, 1044]]) {
    await page.setViewportSize({ width: w, height: h });
    const found = await page.evaluate(() => (window.btsOverlaps ? window.btsOverlaps({ overlay: "[data-poster] svg", subject: "[data-poster] [data-subject-root]" }) : "btsOverlaps missing"));
    console.log(`${name} ${w}×${h}:`, JSON.stringify(found) === "[]" || found === undefined ? "no overlaps" : found);
  }
  await page.close();
}
await browser.close();
