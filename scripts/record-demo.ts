// Records the product demo against a RUNNING dev server in mock mode (no keys, $0): the beats of docs/video/script.md rev 5,
// with Morning brief as the hero, at 1920 × 1080.
//   Use a fresh database so the radar's recorded cron run, the seeded history and the unread dot are in place:
//     rm -rf data/video && NIMBUS_DATA_DIR=./data/video pnpm dev -p 3232   # one terminal
//     NIMBUS_DATA_DIR=./data/video NIMBUS_URL=http://localhost:3232 pnpm demo:video
// Beats: overview → Morning brief run one (goal typed, plan draft with one step dragged, Approve plan, the lanes, the
// Analyst's segment opens the client's email in Agent I/O, the brief, Approve · Approve · Approve & always allow on the
// reviewer's reply,
// the summary) → Memory & skill → run two (✦ learned, the reviewer's reply goes out under the rule, cheaper) → Hackathon radar from
// its unread dot → the status pill (a radar run waits while Morning brief is open; approved from the pill) → a run started
// from the chat endpoint (/v1, trigger "chat") → Token Factory watch (the routing proposal, approved) → the Overview again.
// Output: docs/demo/nimbus-demo.webm, plus nimbus-demo.mp4 (libx264, slow, crf 17, 30 fps) when ffmpeg is installed; for the
// video session, docs/demo/raw/nimbus-demo-<stamp>.webm and docs/demo/raw/beats.json: [{ beat, tStart, tEnd, targets }],
// seconds from the start of the recording, and per beat the callout targets' boxes { x, y, w, h } in recording pixels
// (docs/video/board.md "From the new take"). Sub-beats such as approve-1 start at the frame of their click and carry that card's approval-card and approve-buttons boxes.
// Dev tooling only: nothing in src/ imports this, so it never reaches the production bundle.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { chromium, type Locator, type Page } from "playwright";
import { getDb, retryBusy, schema } from "../src/db";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { withPolicy } from "../src/runtime/skills";

const BASE = process.env.NIMBUS_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "demo");
const TMP = path.join(OUT, ".tmp-video");
const BRIEF = WORKSTREAMS.find((w) => w.id === "ws-brief")!;
const RADAR = WORKSTREAMS.find((w) => w.id === "ws-radar")!;
const GOAL = "Every weekday at 8: read my inbox, calendar and GitHub. Tell me what needs me and draft the replies.";

// Beat markers: seconds of wall clock since the recording started (the video starts when the page is created).
let t0 = 0;
type Box = { x: number; y: number; w: number; h: number };
const marks: { beat: string; at: number; targets: Record<string, Box> }[] = [];
const mark = (beat: string) => marks.push({ beat, at: +((Date.now() - t0) / 1000).toFixed(2), targets: {} });
const missing: string[] = [];

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const demo = (page: Page, name: string) => page.locator(`[data-demo="${name}"]`).first();

/** Read the callout targets' boxes into the current beat (call it at the beat's middle, and again after a scroll). */
async function targets(page: Page, named: Record<string, Locator>) {
  const beat = marks[marks.length - 1];
  for (const [name, loc] of Object.entries(named)) {
    const r = await loc.boundingBox({ timeout: 1500 }).catch(() => null);
    // clipped to the 1920 × 1080 frame: a tall panel (Agent I/O) runs past the bottom
    const b = r && { x: Math.max(0, r.x), y: Math.max(0, r.y), right: Math.min(1920, r.x + r.width), bottom: Math.min(1080, r.y + r.height) };
    if (b && b.right - b.x > 0 && b.bottom - b.y > 0) beat.targets[name] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.right - b.x), h: Math.round(b.bottom - b.y) };
    else if (!beat.targets[name]) missing.push(`${beat.beat}:${name}`);
  }
}
/** A doc section: its heading through the element after it (the list or the paragraph), as one box. */
function section(page: Page, heading: RegExp): Locator {
  return page.locator("aside h2, aside h3").filter({ hasText: heading }).first();
}
async function sectionBox(page: Page, name: string, heading: RegExp) {
  const h = section(page, heading);
  const box = await h.evaluate((el) => {
    const next = el.nextElementSibling ?? el;
    const a = el.getBoundingClientRect(), b = next.getBoundingClientRect();
    const x = Math.min(a.left, b.left), y = a.top;
    return { x, y, w: Math.max(a.right, b.right) - x, h: b.bottom - y };
  }).catch(() => null);
  const beat = marks[marks.length - 1];
  if (box && box.h > 0) beat.targets[name] = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) };
  else missing.push(`${beat.beat}:${name}`);
}

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

async function resetForTake() {
  // The hero starts clean: run one has no memories and no rule (three approval cards), run two visibly learned something.
  // The radar keeps its recorded run and unread dot but loses its seeded rule, so its next run waits for you in the pill.
  const db = await getDb();
  // Other dev servers may hold the SQLite lock: retry for a while (retryBusy backs off), then say what to do.
  try {
    await retryBusy(() => db.delete(schema.memories).where(eq(schema.memories.workstreamId, BRIEF.id)), 40);
    await retryBusy(() => db.delete(schema.policies).where(eq(schema.policies.workstreamId, BRIEF.id)), 40);
    await retryBusy(() => db.update(schema.skills).set({ content: BRIEF.skill, previous: null, updatedRunId: null }).where(eq(schema.skills.workstreamId, BRIEF.id)), 40);
    await retryBusy(() => db.delete(schema.policies).where(eq(schema.policies.workstreamId, RADAR.id)), 40);
    await retryBusy(() => db.update(schema.skills).set({ content: withPolicy(RADAR.skill, []), previous: null, updatedRunId: null }).where(eq(schema.skills.workstreamId, RADAR.id)), 40);
  } catch (e) {
    console.error("Could not reset the demo workstreams: the SQLite file is locked by another process (a stale `next dev`?). Stop other dev servers and retry.");
    throw e;
  }
}

async function glide(page: Page, target: Locator) {
  // Timeline segments grow with the clock and dithered surfaces animate, so Playwright's "stable" check can never pass
  // on a live run: scroll with a short timeout, fall back to a plain scrollIntoView, and never wait for stability.
  await target.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => target.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" })).catch(() => {}));
  await pause(120);
  const box = await target.boundingBox();
  if (!box) throw new Error("element has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
  await pause(180);
}
async function click(page: Page, target: Locator, beat?: string) {
  await glide(page, target);
  if (beat) mark(beat);
  await target.click({ delay: 90, force: true });
}
const railItem = (page: Page, title: string) => page.locator("nav button", { hasText: title }).first();
const approveIn = (card: Locator, name: string | RegExp) => card.getByRole("button", { name, exact: typeof name === "string" });
const card = (page: Page, to: string) => page.locator('[data-demo="approval-card"]', { hasText: to }).first();
const pendingCards = (page: Page) => page.locator('[data-demo="approval-card"]');
/** The pending card for this recipient; a real model may word the recipient differently, so fall back to the first pending card. */
async function cardFor(page: Page, to: string): Promise<Locator> {
  const exact = card(page, to);
  return (await exact.count()) ? exact : pendingCards(page).first();
}
/** A real agent may stop to ask what the mock scripts never ask: answer in the composer so the take keeps moving. */
async function answerQuestions(page: Page) {
  const reply = page.locator("main button", { hasText: /^REPLY$/ });
  if (!(await reply.count())) return;
  answered++;
  await page.locator("textarea").fill("Use what you have and go ahead.");
  await page.locator("textarea").press("Enter");
  await pause(800);
}
let answered = 0;
/** Wait for a locator while answering any question a real agent asks on the way. */
async function until(page: Page, loc: Locator, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await loc.first().isVisible().catch(() => false)) return;
    await answerQuestions(page);
    await pause(500);
  }
  throw new Error(`timed out after ${ms / 1000}s waiting for ${loc}`);
}
/** Wait for the first pending card, then a little longer for the rest of a batch (replies are asked for together). */
async function waitForCards(page: Page, n: number) {
  await until(page, pendingCards(page), 240_000);
  for (let i = 0; i < 40 && (await pendingCards(page).count()) < n; i++) await pause(500);
}
/** Prefer the mock script's label; a real model's segments are labelled differently, so fall back by position. */
async function preferred(primary: Locator, fallback: Locator): Promise<Locator> {
  return (await primary.count()) ? primary.first() : fallback;
}
const chat: { role: "user" | "nimbus"; text: string; seconds?: number }[] = [];

/** An approval click as its own sub-beat: the pointer arrives, the beat starts, that card's boxes are read, then the click. */
async function approveAt(page: Page, approval: Locator, name: string | RegExp, beat: string) {
  await approval.scrollIntoViewIfNeeded().catch(() => {});
  const button = approveIn(approval, name);
  await glide(page, button);
  mark(beat);
  await targets(page, { "approval-card": approval, "approve-buttons": approval.locator('[data-demo="approve-buttons"]') });
  await button.click({ delay: 90, force: true });
}

async function approvePlan(page: Page, beat?: string) {
  await click(page, page.getByRole("button", { name: "Approve plan", exact: true }), beat);
}

/** Morning brief, the first morning: everything you see the first time. */
async function briefOne(page: Page) {
  mark("brief1-goal");
  await click(page, railItem(page, "Morning brief"));
  await pause(1400);
  await click(page, page.locator("textarea"));
  await page.keyboard.type(GOAL, { delay: 26 });
  await page.getByText(/≈ \$/).first().waitFor({ timeout: 10_000 }).catch(() => {}); // the cost pill, before Enter
  await pause(1200);
  await page.locator("textarea").focus();
  await page.keyboard.press("Enter");

  // the plan is a draft: nothing runs until Approve plan
  const steps = page.locator('ol[aria-label="Plan steps"] > li');
  await steps.first().waitFor({ timeout: 30_000 });
  mark("brief1-plan-arrives");
  await pause(1600);
  await targets(page, { plan: demo(page, "plan"), estimate: demo(page, "estimate"), tools: demo(page, "tools") });
  await pause(1800);
  // the mock: "invoices and digests under can wait" up to right after the reading; a real plan may have fewer steps
  const n = await steps.count();
  if (n >= 3) await steps.nth(n - 1).dragTo(steps.nth(1), { timeout: 10_000 }).catch(() => missing.push("brief1-plan-arrives:drag"));
  await pause(1600);
  await approvePlan(page, "brief1-approve-plan");
  const approvedAt = Date.now();

  // the lanes fill: the Analyst reads, three Writers draft at the same time
  await pause(1200);
  mark("brief1-timeline");
  await until(page, page.locator('g[role="button"][aria-label^="Writer 3"]').or(pendingCards(page)), 240_000);
  await pause(1800);
  await targets(page, { lanes: demo(page, "lanes"), "model-badge": demo(page, "model-badge"), "run-cost": demo(page, "run-cost") });
  // the board wants 13–30 s from Approve plan to the Agent I/O click: room for three callouts on the lanes
  await pause(Math.max(1800, 15_000 - (Date.now() - approvedAt)));

  // the Analyst's segment that read the client's email: Agent I/O shows what it read
  // the mock Analyst's labelled segment; on the real models the Researcher does the reading (its 2nd segment reads mail)
  await soft("brief1-agent-io", async () => {
    const reader = page.locator('g[role="button"][aria-label*="Reading the three that matter"]').or(page.locator('g[role="button"][aria-label^="Researcher"]').nth(1)).or(page.locator('g[role="button"][aria-label^="Analyst"]').nth(1)).first();
    await click(page, reader, "brief1-agent-io");
    await pause(1200);
    // the ring goes on the client's email itself: scroll the Inspector so its first lines sit near the top, then read the box
    const email = demo(page, "agent-io").locator("pre", { hasText: "client@example.com" }).first();
    await email.evaluate((el) => el.scrollIntoView({ block: "start", behavior: "smooth" })).catch(() => {});
    await pause(700);
    await targets(page, { "agent-io": email });
    await pause(2600);
  });

  // the brief itself: Needs you today, ranked; Can wait
  await soft("brief1-doc", async () => {
    mark("brief1-doc");
    await click(page, page.getByRole("tab", { name: "Artifact" }));
    await click(page, await preferred(page.locator("main button", { hasText: /Morning brief ·/ }), page.locator("main button", { hasText: /doc · open/ }).first()));
    await section(page, /Needs you today/).waitFor({ timeout: 30_000 }).catch(() => {});
    await pause(1200);
    await targets(page, { "brief-doc": demo(page, "brief-doc") });
    await sectionBox(page, "needs-you", /Needs you today/);
    await pause(1800);
    await section(page, /Can wait/).scrollIntoViewIfNeeded().catch(() => {});
    await pause(900);
    await sectionBox(page, "can-wait", /Can wait/);
    await pause(1800);
  });

  // the gate: Approve the client's reply, Approve the teammate's, Approve & always allow on the reviewer's
  mark("brief1-approvals");
  await waitForCards(page, 3);
  const client = await cardFor(page, "client@example.com");
  await client.scrollIntoViewIfNeeded().catch(() => {});
  await pause(1600);
  await targets(page, { "approval-card": client, "approve-buttons": client.locator('[data-demo="approve-buttons"]'), tray: demo(page, "tray") });
  await pause(2400);
  // about 2 s between the clicks: the music's drop lands on approve-1
  await approveAt(page, client, "Approve", "approve-1");
  await pause(2000);
  await approveAt(page, await cardFor(page, "teammate@example.com"), "Approve", "approve-2");
  await pause(2000);
  await approveAt(page, await cardFor(page, "reviewer@example.com"), /Approve & always allow/, "always-allow");
  await demo(page, "rule-line").waitFor({ timeout: 20_000 }).catch(() => {});
  await demo(page, "rule-line").scrollIntoViewIfNeeded().catch(() => {});
  await pause(1200);
  await targets(page, { "rule-line": demo(page, "rule-line") });
  await pause(1800);

  // the summary counts up: cost, tokens, time, vs baseline, memories saved
  const summary = page.locator("p", { hasText: /^Run summary$/ });
  await until(page, summary, 300_000);
  await summary.scrollIntoViewIfNeeded();
  mark("brief1-summary");
  await pause(1800);
  await targets(page, { "summary-cost": demo(page, "summary-cost"), "vs-baseline": demo(page, "vs-baseline") });
  await pause(3200);
}

/** The next morning: the plan carries what it learned, the reviewer's reply goes out under the rule, the run costs less. */
async function briefTwo(page: Page) {
  mark("brief2-plan");
  await click(page, page.getByRole("tab", { name: "Artifact" }));
  await click(page, page.getByRole("button", { name: "Run Morning brief" }));
  await page.locator('ol[aria-label="Plan steps"] > li').first().waitFor({ timeout: 30_000 });
  mark("brief2-plan-arrives");
  await demo(page, "learned-chip").waitFor({ timeout: 20_000 }).catch(() => {});
  await pause(1600);
  await targets(page, { "learned-chip": demo(page, "learned-chip"), plan: demo(page, "plan") });
  await pause(2000);
  await approvePlan(page);

  mark("brief2-run");
  // the client and the teammate still ask; the reviewer's reply goes out under the rule with no card
  await waitForCards(page, 2);
  await pause(2400);
  await targets(page, { "run2-cost": demo(page, "run-cost"), "learned-chip": demo(page, "learned-chip") });
  // whatever still asks (the mock: the client and the teammate); a ruled reply never shows a card
  for (let k = 0; k < 4 && (await pendingCards(page).count()) > 0; k++) {
    await click(page, approveIn(pendingCards(page).first(), "Approve"));
    await pause(1300);
  }
  const summary = page.locator("p", { hasText: /^Run summary$/ });
  await until(page, summary, 300_000);
  await summary.scrollIntoViewIfNeeded();
  await pause(1400);
  await targets(page, { "summary-cost": demo(page, "summary-cost"), "run2-cost": demo(page, "run-cost") });
  await pause(2600);
}

/** A radar run in the background while Morning brief is open: the pill says it waits; approve it from the pill. */
async function radarInThePill(page: Page) {
  mark("status-pill");
  const res = await page.request.post(`${BASE}/api/runs`, { data: { workstreamId: RADAR.id } });
  const { runId } = (await res.json()) as { runId: string };
  await pause(1500);
  await page.request.post(`${BASE}/api/runs/${runId}/plan`, { data: { approve: true } }); // approved as drafted
  const pill = page.locator('button[aria-haspopup="dialog"]').first();
  await page.getByText(/waiting/i).first().waitFor({ timeout: 120_000 }).catch(() => {});
  await pause(1600);
  await targets(page, { "status-pill": pill });
  await pause(1400);
  await click(page, pill);
  const approve = page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).first();
  const anyApprove = (await approve.count()) ? approve : page.getByRole("button", { name: "Approve", exact: true }).first();
  await anyApprove.waitFor({ timeout: 120_000 });
  await pause(1800);
  await click(page, anyApprove, "pill-approve");
  await pause(1800);
  await page.keyboard.press("Escape");
  await pause(800);
}

/** A run started from a chat app: the same endpoint OpenClaw and Hermes call, then the same run in the web app. */
async function chatRun(page: Page): Promise<boolean> {
  // every exchange is kept for the video's phone screens (raw/chat-transcript-<stamp>.json)
  const ask = async (text: string, user = "demo-phone") => {
    const t = Date.now();
    chat.push({ role: "user", text });
    const res = await page.request.post(`${BASE}/v1/chat/completions`, { data: { model: "nimbus", user, messages: [{ role: "user", content: text }] }, timeout: 240_000 });
    const body = res.ok() ? ((await res.json()) as { choices?: { message?: { content?: string } }[]; nimbus?: { run_id?: string } }) : null;
    chat.push({ role: "nimbus", text: body?.choices?.[0]?.message?.content ?? `HTTP ${res.status()}`, seconds: +((Date.now() - t) / 1000).toFixed(1) });
    return { res, body };
  };
  await ask("what needs me?").catch(() => null);
  const r = await ask("run morning brief").catch(() => null);
  if (!r || !r.res.ok()) {
    console.log(`chat-run skipped: /v1 answered ${r ? r.res.status() : "nothing"}`);
    return false;
  }
  const runId = r.body?.nimbus?.run_id;
  if (!runId) {
    console.log("chat-run skipped: the reply carried no run id");
    return false;
  }
  await page.goto(`${BASE}/?run=${runId}`);
  const stamp = page.getByText(/from chat/).first();
  await stamp.waitFor({ timeout: 30_000 }).catch(() => {});
  await stamp.scrollIntoViewIfNeeded().catch(() => {});
  mark("chat-run"); // from the moment the run is on screen, not the reload before it
  await pause(1600);
  await targets(page, { "chat-run": stamp });
  await pause(1000);
  await ask("approve all").catch(() => null);
  await pause(3400);
  return true;
}

/** Token Factory watch: the crew prices the week, proposes cheaper routing, waits for you; approve it. */
async function watch(page: Page) {
  mark("watch");
  await click(page, railItem(page, "Token Factory watch"));
  await pause(1200);
  await click(page, page.getByRole("button", { name: "Run Token Factory watch" }));
  await page.locator('ol[aria-label="Plan steps"] > li').first().waitFor({ timeout: 30_000 });
  await pause(1400);
  await approvePlan(page);
  const proposal = page.locator('[data-demo="approval-card"]').first();
  await until(page, proposal, 300_000);
  await click(page, page.getByRole("tab", { name: "Artifact" }));
  const table = page.locator("aside table").first();
  await table.waitFor({ timeout: 30_000 }).catch(() => {});
  await table.scrollIntoViewIfNeeded().catch(() => {});
  await pause(1600);
  await targets(page, { "routing-table": table });
  await pause(2200);
  await click(page, approveIn(proposal, "Approve"), "watch-approve");
  await page.locator("p", { hasText: /^Run summary$/ }).waitFor({ timeout: 180_000 }).catch(() => {});
  await pause(1600);
}

/** A late beat that depends on how a real model behaves: if it fails, say so and keep the rest of the take. */
async function soft(beat: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    missing.push(`${beat} (beat failed: ${e instanceof Error ? e.message.split("\n")[0] : e})`);
    await page0?.keyboard.press("Escape").catch(() => {});
  }
}
let page0: Page | undefined;

async function main() {
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  await resetForTake();

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, colorScheme: "dark", recordVideo: { dir: TMP, size: { width: 1920, height: 1080 } } });
  await ctx.addInitScript(CURSOR);
  t0 = Date.now();
  const page = await ctx.newPage();
  page0 = page;
  const started = Date.now();

  // the Overview: stat cards count up, the charts draw in, the workstream list with its schedules
  await page.goto(`${BASE}/`);
  await page.getByText("Spend by tier").first().waitFor({ timeout: 30_000 });
  mark("overview");
  await pause(2600);
  await targets(page, { workstreams: demo(page, "workstreams"), "spend-chart": demo(page, "spend-chart"), "router-gauge": demo(page, "router-gauge") });
  // about 12 s: the pointer rests on the spend chart, then on the router gauge (one callout each)
  await pause(1400);
  await glide(page, demo(page, "spend-chart"));
  await pause(3200);
  await glide(page, demo(page, "router-gauge"));
  await pause(3000);

  await briefOne(page);
  // run two only makes sense if run one learned something: stop here rather than spend on a run two with nothing learned
  const learnedOne = (await (await page.request.get(`${BASE}/api/workstreams/${BRIEF.id}/learning`)).json()) as { memories: unknown[] };
  if (!learnedOne.memories.length) throw new Error("the Learner saved nothing in run one: stopping before run two");

  mark("memory-skill");
  await click(page, page.getByRole("tab", { name: "Memory & skill" }));
  await demo(page, "memories").waitFor({ timeout: 20_000 }).catch(() => {});
  await pause(1600);
  const forget = demo(page, "forget");
  await demo(page, "memories").locator("li").first().hover().catch(() => {}); // Forget shows on hover
  await pause(600);
  await targets(page, { memories: demo(page, "memories"), "skill-file": demo(page, "skill-file"), forget });
  await pause(2400);
  await demo(page, "skill-file").scrollIntoViewIfNeeded().catch(() => {});
  await pause(1200);
  await targets(page, { "skill-file": demo(page, "skill-file") });
  await pause(1800);

  await briefTwo(page);

  // the radar ran at 09:00 on its own: its unread dot, then the digest
  mark("radar");
  await targets(page, { "unread-dot": demo(page, "unread-dot") });
  await pause(1600);
  await click(page, railItem(page, "Hackathon radar"));
  await pause(4200);
  await click(page, railItem(page, "Morning brief"));
  await pause(1000);
  await soft("status-pill", () => radarInThePill(page));

  if (!(await chatRun(page).catch((e) => (console.log(`chat-run failed: ${e instanceof Error ? e.message : e}`), false)))) missing.push("chat-run (beat)");

  await soft("watch", () => watch(page));

  // back on the Overview: today's numbers moved, the router gauge shows the approved rule
  mark("overview-after");
  await click(page, railItem(page, "Overview"));
  await page.getByText("Spend by tier").first().waitFor({ timeout: 20_000 });
  await pause(2400);
  await targets(page, { "router-gauge": demo(page, "router-gauge"), "spend-chart": demo(page, "spend-chart") });
  await pause(3200);

  const total = +((Date.now() - t0) / 1000).toFixed(2);
  const video = page.video();
  await ctx.close();
  await browser.close();
  const src = await video!.path();
  const webm = path.join(OUT, "nimbus-demo.webm");
  renameSync(src, webm);
  // for the video session: the raw take under a dated name, where each beat starts and ends, and the callout targets
  const raw = path.join(OUT, "raw");
  mkdirSync(raw, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
  copyFileSync(webm, path.join(raw, `nimbus-demo-${stamp}.webm`));
  const beats = marks.map((m, i) => ({ beat: m.beat, tStart: m.at, tEnd: marks[i + 1]?.at ?? total, targets: m.targets }));
  writeFileSync(path.join(raw, "beats.json"), JSON.stringify(beats, null, 2) + "\n");
  if (chat.length)
    writeFileSync(path.join(raw, `chat-transcript-${stamp}.json`), JSON.stringify({ captured: new Date().toISOString().slice(0, 10), endpoint: "/v1/chat/completions", model: "nimbus", user: "demo-phone", mode: process.env.NIMBUS_MODEL || "unknown", placeholder: false, exchanges: chat }, null, 2) + "\n");
  console.log(`raw take and beats → docs/demo/raw/nimbus-demo-${stamp}.webm (${beats.length} beats, ${total}s)`);
  if (missing.length) console.log(`targets not found: ${missing.join(", ")}`);
  if (answered) console.log(`answered ${answered} question(s) an agent asked on the way`);
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
