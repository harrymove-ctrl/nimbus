// Render an HTML file to PDF (and a PNG preview) with the project's Playwright.
// Usage: node scripts/export-pdf.mjs [in.html] [out.pdf] [out.png]
// Defaults to the one-pager. Headless Chromium cannot launch inside the Claude sandbox; run it from a terminal.
import { chromium } from "playwright";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [, , inArg = "docs/onepager/nimbus-onepager.html", pdfArg, pngArg] = process.argv;
const input = resolve(inArg);
const pdf = resolve(pdfArg ?? input.replace(/\.html$/, ".pdf"));
const png = resolve(pngArg ?? input.replace(/\.html$/, ".png"));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(input).href, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.emulateMedia({ media: "print" });
// preferCSSPageSize: the page's own @page rule (A4 for the one-pager, 1280x720 for the deck) wins.
await page.pdf({ path: pdf, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
await page.emulateMedia({ media: "screen" });
await page.screenshot({ path: png, fullPage: true });
await browser.close();
console.log("wrote", pdf, "and", png);
