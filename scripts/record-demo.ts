// Records the product demo as a video against a RUNNING dev server in mock mode (no keys, $0).
//   pnpm dev            # in one terminal
//   pnpm demo:video     # NIMBUS_URL=http://localhost:3232 pnpm demo:video   (default port 3000)
// Output: docs/demo/nimbus-demo.webm, plus nimbus-demo.mp4 when ffmpeg is installed. Dev tooling only: nothing in
// src/ imports this, so it never reaches the production bundle.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { chromium, type Locator, type Page } from "playwright";
import { getDb, retryBusy, schema } from "../src/db";
import { WORKSTREAMS } from "../src/lib/workstreams";

const BASE = process.env.NIMBUS_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "demo");
const TMP = path.join(OUT, ".tmp-video");
const GOAL_1 = "Why did checkout conversion drop on Oct 14?";
const GOAL_2 = "Same question, a week later: why did checkout conversion drop?";

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A visible cursor and click ripple: Playwright's video does not draw the pointer.
const CURSOR = `(() => {
  const mk = () => {
    const c = document.createElement('div');
    c.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(255,255,255,.9);box-shadow:0 0 0 2px rgba(0,0,0,.55),0 2px 10px rgba(0,0,0,.5);transition:transform .12s ease-out;left:-50px;top:-50px';
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.transform = 'scale(.65)'; }, true);
    addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
  };
  if (document.documentElement) mk(); else addEventListener('DOMContentLoaded', mk);
})();`;

async function resetLearning() {
  // A clean slate so run 1 has no memories and no policy: the approval card shows, and run 2 visibly learned something.
  const db = await getDb();
  const w = WORKSTREAMS.find((x) => x.id === "ws-checkout")!;
  // Other dev servers may hold the SQLite lock: retry for a while (retryBusy backs off), then say what to do.
  try {
    await retryBusy(() => db.delete(schema.memories).where(eq(schema.memories.workstreamId, w.id)), 40);
    await retryBusy(() => db.update(schema.skills).set({ content: w.skill, previous: null }).where(eq(schema.skills.workstreamId, w.id)), 40);
  } catch (e) {
    console.error("Could not reset the demo workstream: the SQLite file is locked by another process (a stale `next dev`?). Stop other dev servers and retry.");
    throw e;
  }
}

async function glide(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("element has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
  await pause(180);
}
async function click(page: Page, target: Locator) {
  await glide(page, target);
  await target.click({ delay: 90 });
}

async function runOnce(page: Page, goal: string, opts: { first: boolean }) {
  await click(page, page.locator("textarea"));
  await page.keyboard.type(goal, { delay: 32 });
  await page.getByText(/≈ \$/).first().waitFor({ timeout: 10_000 }).catch(() => {}); // the cost pill
  await pause(900);
  // Enter runs (the spec's keyboard rule) and avoids the Inspector's fade overlay, which can sit over the RUN button.
  await page.locator("textarea").focus();
  await page.keyboard.press("Enter");

  // plan card and the 3 s cancel countdown
  await page.getByText(/Starting in|Started/).first().waitFor({ timeout: 20_000 }); // plan card footer
  await pause(opts.first ? 3600 : 2400);

  // lanes fill; open the Analyst's hop in the Inspector
  const analyst = page.locator('g[role="button"][aria-label^="Analyst"]').first();
  await analyst.waitFor({ timeout: 30_000 });
  await pause(opts.first ? 2600 : 1600);
  if (opts.first) {
    await click(page, analyst);
    await pause(3800);
  }

  // the Researcher asks a question: answer with the chip
  const chip = page.getByRole("button", { name: "30-day average" });
  await chip.waitFor({ timeout: 45_000 });
  await pause(opts.first ? 1800 : 900);
  await click(page, chip);

  if (opts.first) {
    // approval card: Approve & always allow
    const always = page.getByRole("button", { name: /Approve & always allow/ }).first();
    await always.waitFor({ timeout: 60_000 });
    await pause(3000);
    await click(page, always);
    await pause(1600);
  } else {
    // run 2: the policy from run 1 is honored, so there is no approval card at all
    await page.getByText(/learned ·/).first().waitFor({ timeout: 60_000 }); // the ✦ learned chip on the orchestrator lane
    await pause(2200);
  }

  // artifact v2, then the run summary with the SKILL.md diff
  await page.getByText(/it was iOS Safari/).first().waitFor({ timeout: 90_000 });
  await pause(2800);
  const summary = page.locator("p", { hasText: /^Run summary$/ });
  await summary.waitFor({ timeout: 90_000 });
  await summary.scrollIntoViewIfNeeded();
  await pause(opts.first ? 4200 : 3800);
}

async function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  await resetLearning();

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", recordVideo: { dir: TMP, size: { width: 1440, height: 900 } } });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const started = Date.now();

  // beat 1: the boot cloud (2 s)
  await page.goto(BASE);
  await pause(2400);
  await page.locator("nav").waitFor({ timeout: 20_000 });

  // beat 2: pick the workstream
  await click(page, page.locator("nav button", { hasText: "Checkout conversion drop" }).first());
  await pause(1400);

  // beats 3–8: the full run
  await runOnce(page, GOAL_1, { first: true });

  // the Memory & skill tab: what was learned
  await click(page, page.getByRole("tab", { name: "Memory & skill" }));
  await pause(3200);
  await click(page, page.getByRole("tab", { name: "Artifact" }));
  await pause(800);

  // beat 9: run it again: ✦ learned chip, no approval card, same answer
  await runOnce(page, GOAL_2, { first: false });
  await page.locator('span:has-text("learned")').first().scrollIntoViewIfNeeded().catch(() => {});
  await pause(1500);

  const video = page.video();
  await ctx.close();
  await browser.close();
  const src = await video!.path();
  const webm = path.join(OUT, "nimbus-demo.webm");
  renameSync(src, webm);
  rmSync(TMP, { recursive: true, force: true });
  console.log(`recorded ${(Date.now() - started) / 1000}s of wall time → ${path.relative(process.cwd(), webm)}`);

  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart", path.join(OUT, "nimbus-demo.mp4")]);
    console.log("converted → docs/demo/nimbus-demo.mp4");
  } catch {
    console.log("ffmpeg not available: only the .webm was written");
  }
  if (!existsSync(webm)) process.exit(1);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
