// The Conversations inbox (docs/CONVERSATION.md C0) in mock mode ($0, no server): GET /api/conversations is called
// in-process on runs started through every door, one of them left waiting at an approval.
//   pnpm check:inbox
/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are read loosely here */
process.env.NIMBUS_DATA_DIR = "./data/check-inbox"; // own database; .env.local already names ./data
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_SCHEDULER = "off";
process.env.NIMBUS_TELEGRAM_MODE = "off";
delete process.env.TELEGRAM_BOT_TOKEN; // nothing is pushed anywhere
import { rmSync } from "node:fs";
import { eq } from "drizzle-orm";
import { dataDir, getDb, schema } from "../src/db";
import { GET } from "../src/app/api/conversations/route";
import { doorOf, SCAN_CAP, type Conversation, type Conversations } from "../src/runtime/conversations";
import { startRun } from "../src/runtime/source";
import { WORKSTREAMS } from "../src/lib/workstreams";

rmSync(dataDir(), { recursive: true, force: true });
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail.slice(0, 1200).replace(/\n/g, "\n    ")}` : ""}`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (f: () => boolean, ms = 20_000) => {
  const t = Date.now();
  while (!f() && Date.now() - t < ms) await sleep(50);
  return f();
};
const tools = (id: string) => WORKSTREAMS.find((w) => w.id === id)!.tools;
async function inbox(qs = ""): Promise<Conversations & { status: number }> {
  const res = await GET(new Request(`http://localhost:3241/api/conversations${qs}`));
  return { ...((await res.json()) as any), status: res.status };
}
const ids = (rows: Conversation[]) => rows.map((r) => r.runId);
const short = (rows: Conversation[]) => rows.map((r) => `${r.runId.slice(0, 10)} ${r.door} ${r.state} ${r.waiting}`).join(" | ");

// the mock seeds months of demo history: clear it so the check sees only its own runs
const db = await getDb();
for (const t of [schema.runs, schema.runEvents, schema.approvals, schema.artifacts]) await db.delete(t);

console.log("— Doors (pure)");
check("triggers map to doors: manual web, cron schedule, telegram telegram, chat chat, job terminal, anything else api", doorOf("manual") === "web" && doorOf("cron") === "schedule" && doorOf("telegram") === "telegram" && doorOf("chat") === "chat" && doorOf("job") === "terminal" && doorOf("mcp") === "api");

console.log("— Empty");
{
  const e = await inbox();
  check("an empty database gives no rows and zero counts (the UI shows the starter cards)", e.status === 200 && e.rows.length === 0 && e.counts.all === 0 && e.counts.needs === 0, JSON.stringify(e).slice(0, 300));
  const bad = await inbox("?filter=nope");
  check("an unknown filter is a 400", bad.status === 400);
}

console.log("— Three doors, one waiting");
// the Telegram run starts first, so it is the oldest: it must still sit at the top while it waits
const tg = startRun({ workstreamId: "ws-brief", title: "Morning brief", goal: "Brief me on today\nwith the calendar first", trigger: "telegram", mode: "ask", tools: tools("ws-brief") });
const waiting = await waitFor(() => tg.events.some((e) => e.type === "approval.request"));
check("the Telegram run reaches an approval and waits", waiting && !tg.finished);
await sleep(20);
const web = startRun({ workstreamId: "ws-radar", title: "Hackathon radar", goal: "Find the zebra hackathons this week", trigger: "manual", mode: "auto-low", tools: tools("ws-radar") });
await web.settled;
await sleep(20);
const cron = startRun({ workstreamId: "ws-radar", title: "Hackathon radar", goal: "Scan for new hackathons", trigger: "cron", mode: "auto-low", tools: tools("ws-radar") });
await cron.settled;
await sleep(20);
const gone = startRun({ workstreamId: "ws-release", title: "Release notes", goal: "Draft the archived notes", trigger: "manual", mode: "ask", tools: tools("ws-release") });
await sleep(300);
gone.stop("stop");
await gone.settled.catch(() => {});

{
  const all = await inbox("?filter=all");
  const row = (id: string) => all.rows.find((r) => r.runId === id);
  check(`all four runs are listed (${all.rows.length})`, all.rows.length === 4 && [tg.id, web.id, cron.id, gone.id].every((id) => row(id)), short(all.rows));
  check("doors: the web run is web, the scheduled one schedule, the Telegram one telegram", row(web.id)?.door === "web" && row(cron.id)?.door === "schedule" && row(tg.id)?.door === "telegram", short(all.rows));
  const t = row(tg.id)!;
  check(`the waiting run is first, state needs, waiting ${t?.waiting} (the open approvals)`, all.rows[0]?.runId === tg.id && t.state === "needs" && t.waiting >= 1, short(all.rows));
  check("its `last` says what waits on you", /^Approve: /.test(t.last), t.last);
  check("`asked` is the goal's first line", t.asked === "Brief me on today", t.asked);
  check("the finished runs are done, the stopped one stopped; nothing is `quiet`", row(web.id)?.state === "done" && row(cron.id)?.state === "done" && row(gone.id)?.state === "stopped" && all.rows.every((r) => r.state !== "quiet"), short(all.rows));
  check("after the waiting run, newest first", ids(all.rows.slice(1)).join() === [gone.id, cron.id, web.id].join(), short(all.rows));
  const w = row(web.id)!;
  check("a row carries the workstream title, a `last` line, its cost and times", w.workstreamTitle === "Hackathon radar" && w.workstreamId === "ws-radar" && w.last.length > 0 && !w.last.includes("\n") && typeof w.costUsd === "number" && w.startedAt > 0 && !!w.endedAt && w.endedAt >= w.startedAt, JSON.stringify(w));
  check("counts: needs 1, scheduled 1, phone 1, all 4", all.counts.needs === 1 && all.counts.scheduled === 1 && all.counts.phone === 1 && all.counts.all === 4, JSON.stringify(all.counts));

  const needs = await inbox("?filter=needs");
  check("filter=needs: only the waiting run", ids(needs.rows).join() === tg.id, short(needs.rows));
  const sched = await inbox("?filter=scheduled");
  check("filter=scheduled: only the cron run", ids(sched.rows).join() === cron.id, short(sched.rows));
  const phone = await inbox("?filter=phone");
  check("filter=phone: only the Telegram run", ids(phone.rows).join() === tg.id, short(phone.rows));
  check("the default filter is all", (await inbox()).rows.length === 4);
}

console.log("— Search");
{
  const g = await inbox("?q=ZEBRA");
  check("q searches goals, any case ('ZEBRA' finds the web run only)", ids(g.rows).join() === web.id && g.counts.all === 1, short(g.rows));
  const msgs = web.events.filter((e) => e.type === "message").map((e) => (e.type === "message" ? e.payload.text : ""));
  const word = msgs.join(" ").match(/\b[A-Za-z]{7,}\b/g)?.find((x) => !"find the zebra hackathons this week scan for new hackathons".includes(x.toLowerCase()));
  const m = await inbox(`?q=${encodeURIComponent(word ?? "x")}`);
  check(`q searches messages ('${word}' from the web run's messages finds it)`, !!word && ids(m.rows).includes(web.id), short(m.rows));
  const [art] = await db.select({ title: schema.artifacts.title }).from(schema.artifacts).where(eq(schema.artifacts.runId, cron.id));
  const piece = art?.title.split(/\s+/).find((x) => x.length >= 4 && !/hackathon|radar/i.test(x)) ?? art?.title;
  const a = await inbox(`?q=${encodeURIComponent(piece ?? "x")}`);
  check(`q searches artifact titles ('${piece}' from "${art?.title}")`, !!art && ids(a.rows).includes(cron.id), short(a.rows));
  const none = await inbox("?q=nothing-says-this-qq");
  check("a q nothing matches gives no rows and zero counts", none.rows.length === 0 && none.counts.all === 0);
  const fq = await inbox("?filter=scheduled&q=zebra");
  check("filter and q combine (scheduled + zebra: nothing)", fq.rows.length === 0 && fq.counts.all === 1);
}

console.log("— Archived");
{
  await db.update(schema.workstreams).set({ archived: 1 }).where(eq(schema.workstreams.id, "ws-release"));
  const all = await inbox();
  check("an archived workstream's runs are left out", !ids(all.rows).includes(gone.id) && all.rows.length === 3, short(all.rows));
  await db.update(schema.workstreams).set({ archived: 0 }).where(eq(schema.workstreams.id, "ws-release"));
  check("restored, they are back", ids((await inbox()).rows).includes(gone.id));
}

console.log("— Approved, it leaves the top");
{
  for (let i = 0; i < 6 && !tg.finished; i++) {
    const open = tg.events.filter((e) => e.type === "approval.request").map((e) => (e.type === "approval.request" ? e.payload.approvalId : ""));
    const done = new Set(tg.events.filter((e) => e.type === "approval.resolve").map((e) => (e.type === "approval.resolve" ? e.payload.approvalId : "")));
    for (const id of open) if (!done.has(id)) tg.resolveApproval(id, { decision: "approved", by: "telegram" });
    await Promise.race([tg.settled, sleep(1500)]);
  }
  await tg.settled;
  const all = await inbox();
  const t = all.rows.find((r) => r.runId === tg.id);
  check("once approved and finished, the Telegram run is done, waits on nothing and sorts by time", t?.state === "done" && t.waiting === 0 && all.rows[0]?.runId !== tg.id && all.counts.needs === 0, short(all.rows));
}

console.log("— Scan cap");
{
  const old = Date.now() - 400 * 86_400_000;
  await db.insert(schema.runs).values(Array.from({ length: SCAN_CAP + 10 }, (_, i) => ({ id: `run-old-${i}`, workstreamId: "ws-audit", title: "Old", goal: `old run ${i}`, status: "done", trigger: "cron", startedAt: old + i * 1000, endedAt: old + i * 1000 + 10, model: "mock" })));
  const all = await inbox();
  check(`only the newest ${SCAN_CAP} runs are read, and the newest real runs are still there (${all.rows.length} rows)`, all.scanned === SCAN_CAP && all.rows.length === SCAN_CAP && [tg.id, web.id, cron.id, gone.id].every((id) => ids(all.rows).includes(id)) && !ids(all.rows).includes("run-old-0"), `scanned ${all.scanned}`);
}

const failed = checks.filter(([, ok]) => !ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
