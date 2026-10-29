// Records loop 9 of /welcome (the 60-second tour) against a RUNNING dev server in mock mode: the Hackathon radar's
// finished run open at 1440 × 900, the tour stepping through its first three steps, then Esc. Every number on the page
// is hidden for the take (the mock's costs and token counts must not appear on the landing), and the frame is cropped
// below the top bar to 16:9. Output: public/landing/loop-9.mp4, loop-9.webm, loop-9.jpg.
//   NIMBUS_URL=http://localhost:3250 node --import tsx scripts/record-tour-loop.ts
// Dev tooling only: nothing in src/ imports this.
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.NIMBUS_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "public", "landing");
const TMP = path.join(process.cwd(), "docs", "demo", ".tmp-tour");
const W = 1440;
const H = 900;
const TOP = 48; // the app's top bar (status pill, the tour button) stays out of the frame
const STEP_MS = 2600;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true }).catch(() => chromium.launch({ headless: true }));
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: "dark", recordVideo: { dir: TMP, size: { width: W, height: H } } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  const at = () => +((Date.now() - t0) / 1000).toFixed(2);

  await page.goto(BASE);
  await page.locator('[data-demo="workstreams"]').waitFor({ timeout: 30_000 });
  // no tour nudge in the header, and no numbers anywhere in the frame
  await page.addStyleTag({ content: ".tabular-nums, [data-demo='run-cost'], [data-demo='estimate'] { visibility: hidden !important; }" });
  await page.getByRole("button", { name: /Dismiss the tour hint/ }).click({ timeout: 1500 }).catch(() => {});
  await page.getByRole("button", { name: /Hackathon radar/ }).first().click();
  await page.locator('[data-demo="lanes"]').waitFor({ timeout: 30_000 });
  await pause(1500);

  const start = at();
  await page.getByRole("button", { name: /Take the tour/ }).click();
  const steps: string[] = [];
  for (let i = 0; i < 3; i++) {
    const dlg = page.getByRole("dialog", { name: /^Tour, step/ });
    await dlg.waitFor({ timeout: 5000 });
    steps.push((await dlg.getAttribute("aria-label")) ?? "");
    await pause(STEP_MS);
    if (i < 2) await page.keyboard.press("ArrowRight");
  }
  await page.keyboard.press("Escape");
  await pause(600);
  const end = at();
  console.log("steps:", steps);

  await ctx.close();
  await browser.close();
  const raw = readdirSync(TMP).find((f) => f.endsWith(".webm"));
  if (!raw) throw new Error("no video in " + TMP);
  const src = path.join(TMP, raw);
  const dur = (end - start).toFixed(2);
  const vf = `crop=${W}:${Math.round((W * 9) / 16)}:0:${TOP},scale=1280:-2:flags=lanczos,fps=24`;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(start), "-i", src, "-t", dur, "-an", "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, "loop-9.mp4")]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(start), "-i", src, "-t", dur, "-an", "-vf", vf, "-c:v", "libvpx-vp9", "-crf", "34", "-b:v", "0", "-deadline", "good", "-cpu-used", "4", "-row-mt", "1", path.join(OUT, "loop-9.webm")]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(start + 1.2), "-i", src, "-frames:v", "1", "-vf", `crop=${W}:${Math.round((W * 9) / 16)}:0:${TOP},scale=1280:-2:flags=lanczos`, "-q:v", "4", path.join(OUT, "loop-9.jpg")]);
  rmSync(TMP, { recursive: true, force: true });
  console.log(`loop-9: ${dur} s, from ${raw}`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
