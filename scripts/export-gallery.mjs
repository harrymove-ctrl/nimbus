// Render each .frame of docs/gallery/nimbus-gallery.html to a 3:2 JPEG (3600x2400, under 5 MB) for the Devpost gallery.
// Usage: node scripts/export-gallery.mjs [in.html] [out-dir]   (headless Chromium cannot start inside the Claude sandbox: run from a terminal)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , inArg = "docs/gallery/nimbus-gallery.html", outArg = "docs/gallery"] = process.argv;
const input = resolve(inArg), out = resolve(outArg);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1900, height: 1300 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(input).href, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const frames = page.locator(".frame");
const n = await frames.count();
const names = await page.$$eval(".frame", (els) => els.map((el) => el.getAttribute("data-name") ?? ""));
for (let i = 0; i < n; i++) {
  const file = resolve(out, `${String(i + 1).padStart(2, "0")}-${names[i] || "frame"}.jpg`);
  await frames.nth(i).screenshot({ path: file, type: "jpeg", quality: 90 });
  console.log("wrote", file);
}
await browser.close();
