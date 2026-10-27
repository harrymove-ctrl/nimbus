// Records the product demo as a video against a RUNNING dev server in mock mode (no keys, $0): docs/SUBMISSION.md
// video v3 beats (rev F), minus the curl beat (the final video adds it in editing), at 1920 × 1080.
//   Use a fresh database so the radar's recorded cron run, the seeded history and the unread dot are in place:
//     NIMBUS_DATA_DIR=./data/video pnpm dev          # one terminal (rm -rf data/video first)
//     NIMBUS_DATA_DIR=./data/video pnpm demo:video   # NIMBUS_URL=http://localhost:3232 for another port (default 3000)
// Beats: boot and the rail's skeleton → the Overview (a click on the spend chart's day) → Ship Nimbus run one: the goal is
// typed, the plan arrives as a DRAFT (one step dragged up, one added), Approve plan, the checklist ticks, the Analyst's
// failed run_code in the Loop view as loop 2, the question, the patch, the PR approval (Approve & always allow), the eval
// table, the summary → Memory & skill → Hackathon radar from the rail → the status pill (Morning brief runs in the
// background, its replies approved inline) → Ship Nimbus run two (✦ learned, plan approved as drafted, no question, no
// approval) → the Overview again.
// Output: docs/demo/nimbus-demo.webm, plus nimbus-demo.mp4 (libx264, slow, crf 17, 30 fps) when ffmpeg is installed.
// Dev tooling only: nothing in src/ imports this, so it never reaches the production bundle.
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
const SHIP = WORKSTREAMS.find((w) => w.id === "ws-ship-nimbus")!;

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
  // A clean slate for the hero so run one has no memories and no rule (the question and the approval card show) and run
  // two visibly learned something. The radar is left alone: its recorded run and unread dot are part of the shot.
  const db = await getDb();
  // Other dev servers may hold the SQLite lock: retry for a while (retryBusy backs off), then say what to do.
  try {
    await retryBusy(() => db.delete(schema.memories).where(eq(schema.memories.workstreamId, SHIP.id)), 40);
    await retryBusy(() => db.delete(schema.policies).where(eq(schema.policies.workstreamId, SHIP.id)), 40);
    await retryBusy(() => db.update(schema.skills).set({ content: SHIP.skill, previous: null, updatedRunId: null }).where(eq(schema.skills.workstreamId, SHIP.id)), 40);
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

/** Type the Ship Nimbus goal, then the plan arrives as a draft: edit it on the first run, approve it as drafted on the second. */
async function runShip(page: Page, opts: { first: boolean }) {
  await click(page, page.locator("textarea"));
  await page.keyboard.type(SHIP.goal, { delay: 28 });
  await page.getByText(/≈ \$/).first().waitFor({ timeout: 10_000 }).catch(() => {}); // the cost pill, before Enter
  await pause(1200);
  await page.locator("textarea").focus();
  await page.keyboard.press("Enter");

  // the plan is a draft: nothing runs until Approve plan
  const steps = page.locator('ol[aria-label="Plan steps"] > li');
  await steps.first().waitFor({ timeout: 30_000 });
  await pause(opts.first ? 2200 : 1400);
  if (opts.first) {
    await steps.nth(3).dragTo(steps.nth(1)); // drag "Verify the patch" two steps up
    await pause(1200);
    await click(page, page.getByRole("button", { name: /Add step/ }));
    const n = await steps.count();
    await page.getByRole("textbox", { name: `Step ${n}` }).fill("Run the full suite before the PR");
    await pause(1600);
  }
  await click(page, page.getByRole("button", { name: "Approve plan" }));
  await pause(opts.first ? 2400 : 1600); // the checklist ticks as the lanes fill

  const analyst = page.locator('g[role="button"][aria-label^="Analyst"]').first();
  await analyst.waitFor({ timeout: 60_000 });
  if (opts.first) {
    // the Analyst's wrong flag fails for real; the Loop view shows it as loop 1 Verify ✕ → loop 2
    const failed = page.locator('g[role="button"][aria-label*="pnpm eval --golden"]').first();
    await failed.waitFor({ timeout: 60_000 });
    await click(page, failed);
    await click(page, page.getByRole("tab", { name: "Agent I/O" }));
    await pause(1200);
    await click(page, page.getByRole("button", { name: "Loop", exact: true }));
    for (let k = 0; k < 4; k++) {
      await pause(1500);
      await click(page, page.getByRole("button", { name: "Step", exact: true }));
    }
    await pause(1800);
    const real = page.locator('g[role="button"][aria-label*="pnpm eval --only"]').first();
    await real.waitFor({ timeout: 60_000 });
    await click(page, real);
    await click(page, page.getByRole("button", { name: "Calls", exact: true }));
    await pause(3600);

    // the question: fix in the router or in the golden
    const chip = page.getByRole("button", { name: "Router", exact: true });
    await chip.waitFor({ timeout: 90_000 });
    await pause(1600);
    await click(page, chip);

    // the patch (CODE tab), then the PR approval: Approve & always allow writes the rule
    await page.getByRole("tab", { name: "Artifact" }).click();
    await page.getByRole("button", { name: /^code$/i }).first().waitFor({ timeout: 90_000 });
    await click(page, page.getByRole("button", { name: /^code$/i }).first());
    await pause(3000);
    const always = page.getByRole("button", { name: /Approve & always allow/ }).first();
    await always.waitFor({ timeout: 120_000 });
    await pause(3400);
    await click(page, always);
    await pause(1600);
    await click(page, page.getByRole("button", { name: /^doc$/i }).first());
  } else {
    // run two: the answer is remembered, the PR goes through under the rule, so there is no question and no approval card
    await page.getByText(/learned ·/).first().waitFor({ timeout: 60_000 });
    await pause(2600);
  }

  // PR body v2 with the eval table, then the run summary (impact line, tiles resolving cell by cell)
  await page.getByText(/EVALS/i).first().waitFor({ timeout: 180_000 });
  await pause(2800);
  const summary = page.locator("p", { hasText: /^Run summary$/ });
  await summary.waitFor({ timeout: 120_000 });
  await summary.scrollIntoViewIfNeeded();
  await pause(opts.first ? 4600 : 3800);
}

/** A run in the background (Morning brief) while another workstream is open: the pill, then its replies approved inline. */
async function backgroundRunWithPill(page: Page) {
  const brief = WORKSTREAMS.find((w) => w.id === "ws-brief")!;
  const res = await page.request.post(`${BASE}/api/runs`, { data: { workstreamId: brief.id } });
  const { runId } = (await res.json()) as { runId: string };
  await pause(1200);
  await page.request.post(`${BASE}/api/runs/${runId}/plan`, { data: { approve: true } }); // approved as drafted
  const pill = page.locator('button[aria-haspopup="dialog"]');
  await pill.waitFor({ timeout: 20_000 });
  await pause(2400);
  await click(page, pill);
  await page.getByRole("button", { name: "Approve", exact: true }).first().waitFor({ timeout: 60_000 });
  await pause(2400);
  for (let k = 0; k < 3; k++) {
    const approve = page.getByRole("button", { name: "Approve", exact: true }).first();
    if (!(await approve.isVisible().catch(() => false))) break;
    await click(page, approve);
    await pause(1800);
  }
  await page.keyboard.press("Escape");
  await pause(800);
}

async function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  await resetLearning();

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark", recordVideo: { dir: TMP, size: { width: 1920, height: 1080 } } });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const started = Date.now();

  // beat 1: the boot cloud, then the shell with the rail's sweep skeleton for a visible beat (?loaders=1)
  await page.goto(`${BASE}/?loaders=1`);
  await pause(2400);
  await page.locator("nav").waitFor({ timeout: 20_000 });
  await pause(1800);

  // beat 2: the Overview: stat cards count up, the charts draw in; a click on a day of the spend chart lists its runs
  await page.getByText("Spend by tier").first().waitFor({ timeout: 20_000 });
  await pause(4200);
  const days = page.locator('[role="group"][aria-label="Open the runs of a day"] button:not([disabled])');
  if (await days.count()) await click(page, days.nth(Math.max(0, (await days.count()) - 2)));
  await pause(2600);

  // beat 3: the hero, run one
  await click(page, page.locator("nav button", { hasText: "Ship Nimbus" }).first());
  await pause(1200);
  await runShip(page, { first: true });

  // beat 4: Memory & skill: the rule card, the skill as cards, the diff, the memories
  await click(page, page.getByRole("tab", { name: "Memory & skill" }));
  await pause(2600);
  await click(page, page.getByRole("button", { name: /show diff/i }));
  await pause(3200);
  await click(page, page.getByRole("tab", { name: "Artifact" }));
  await pause(600);

  // beat 5: the radar from the rail: it ran at 09:00 on its own; then the status pill while it is open
  await click(page, page.locator("nav button", { hasText: "Hackathon radar" }).first());
  await pause(4200);
  await backgroundRunWithPill(page);

  // beat 6: run two of Ship Nimbus
  await click(page, page.locator("nav button", { hasText: "Ship Nimbus" }).first());
  await pause(1200);
  await runShip(page, { first: false });
  await page.locator('span:has-text("learned")').first().scrollIntoViewIfNeeded().catch(() => {});
  await pause(1500);

  // beat 7: back on the Overview: today's numbers moved
  await click(page, page.locator("nav button", { hasText: "Overview" }).first());
  await pause(5200);

  const video = page.video();
  await ctx.close();
  await browser.close();
  const src = await video!.path();
  const webm = path.join(OUT, "nimbus-demo.webm");
  renameSync(src, webm);
  rmSync(TMP, { recursive: true, force: true });
  console.log(`recorded ${(Date.now() - started) / 1000}s of wall time → ${path.relative(process.cwd(), webm)}`);

  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-r", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(OUT, "nimbus-demo.mp4")]);
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
