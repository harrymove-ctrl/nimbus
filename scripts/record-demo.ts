// Records the product demo as a video against a RUNNING dev server in mock mode (no keys, $0): docs/SUBMISSION.md
// video script v2, minus the curl beat (the final video adds it in editing).
//   Use a fresh database so the radar's recorded cron run and its unread dot are in the rail:
//     NIMBUS_DATA_DIR=./data/video pnpm dev          # one terminal (rm -rf data/video first)
//     NIMBUS_DATA_DIR=./data/video pnpm demo:video   # NIMBUS_URL=http://localhost:3232 for another port (default 3000)
// Beats: boot and skeleton loaders → rail with six workstreams → Ship Nimbus run one (goal typed, plan card, lanes,
// the failing and then real eval output in Agent I/O, the question, the diff, the PR approval with Approve & always
// allow, the eval table, run summary) → Memory & skill tab → Hackathon radar from the rail → Ship Nimbus run two
// (✦ learned chip, no question, no approval).
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

async function runShip(page: Page, opts: { first: boolean }) {
  await click(page, page.locator("textarea"));
  await page.keyboard.type(SHIP.goal, { delay: 28 });
  await page.getByText(/≈ \$/).first().waitFor({ timeout: 10_000 }).catch(() => {}); // the cost pill, before Enter
  await pause(1200);
  // Enter runs (the spec's keyboard rule) and avoids the Inspector's fade overlay, which can sit over the RUN button.
  await page.locator("textarea").focus();
  await page.keyboard.press("Enter");

  // plan card and its 3 s cancel countdown
  await page.getByText(/Starting in|Started/).first().waitFor({ timeout: 20_000 });
  await pause(opts.first ? 3600 : 2400);

  // lanes fill; the Analyst's first run_code fails (a real wrong flag), the retry prints the real eval output
  const analyst = page.locator('g[role="button"][aria-label^="Analyst"]').first();
  await analyst.waitFor({ timeout: 60_000 });
  await pause(opts.first ? 2600 : 1600);
  if (opts.first) {
    const eval404 = page.locator('g[role="button"][aria-label*="pnpm eval --only"]').first();
    await eval404.waitFor({ timeout: 60_000 });
    await click(page, eval404);
    await click(page, page.getByRole("tab", { name: "Agent I/O" }));
    await pause(4200);

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

  // PR body v2 with the eval table, then the run summary (the tiles resolve cell by cell)
  await page.getByText(/EVALS/i).first().waitFor({ timeout: 180_000 });
  await pause(2800);
  const summary = page.locator("p", { hasText: /^Run summary$/ });
  await summary.waitFor({ timeout: 120_000 });
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

  // beat 1: the boot cloud, then the shell with the rail's sweep skeleton for a visible beat (?loaders=1)
  await page.goto(`${BASE}/?loaders=1`);
  await pause(2400);
  await page.locator("nav").waitFor({ timeout: 20_000 });
  await pause(2200); // six workstreams, the radar with its unread dot

  // beat 2: the hero
  await click(page, page.locator("nav button", { hasText: "Ship Nimbus" }).first());
  await pause(1200);
  await runShip(page, { first: true });

  // beat 3: Memory & skill: the rule card, the skill as cards, the diff, the memories
  await click(page, page.getByRole("tab", { name: "Memory & skill" }));
  await pause(2600);
  await click(page, page.getByRole("button", { name: /show diff/i }));
  await pause(3200);
  await click(page, page.getByRole("tab", { name: "Artifact" }));
  await pause(600);

  // beat 4: the radar from the rail: it ran at 09:00 on its own
  await click(page, page.locator("nav button", { hasText: "Hackathon radar" }).first());
  await pause(5200);

  // beat 5: run two of Ship Nimbus
  await click(page, page.locator("nav button", { hasText: "Ship Nimbus" }).first());
  await pause(1200);
  await runShip(page, { first: false });
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
