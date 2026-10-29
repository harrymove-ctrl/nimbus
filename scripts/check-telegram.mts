// The Nimbus Telegram bot in mock mode ($0, no server, no real bot): docs/ROADMAP.md §2, docs/TELEGRAM.md.
// The poller runs in this process against a local stub standing in for api.telegram.org: scripted getUpdates in, and every
// sendMessage, editMessageText and answerCallbackQuery recorded.
//   pnpm check:telegram
process.env.NIMBUS_DATA_DIR = "./data/check-telegram"; // own database; .env.local already names ./data
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_SCHEDULER = "off";
process.env.NIMBUS_PUBLIC_URL = "https://nimbus.test";
process.env.NIMBUS_NOTIFY_BATCH_MS = "400";
process.env.NIMBUS_TELEGRAM_MODE = "poll";
process.env.NIMBUS_TELEGRAM_POLL_S = "1";
process.env.NIMBUS_TELEGRAM_EDIT_MS = "300";
process.env.NIMBUS_TELEGRAM_BOT_TOKEN = "123456:TEST-TOKEN";
delete process.env.NIMBUS_TELEGRAM_CHAT_ID; // not paired yet: the first case pairs it
import { createServer } from "node:http";
import { rmSync } from "node:fs";
import { dataDir, getDb, schema } from "../src/db";
import { buildView } from "../src/lib/run-view";
import type { AnyRunEvent } from "../src/lib/events";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { liveRuns, startRun, type RunHandle } from "../src/runtime/source";
import { PRIVATE_TEXT, claimPoller, normalize, startTelegram, stopTelegram } from "../src/runtime/telegram";

const T0 = Date.now();
rmSync(dataDir(), { recursive: true, force: true });
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail.replace(/\n/g, "\n    ")}` : ""}`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (f: () => boolean, ms = 15_000) => {
  const t = Date.now();
  while (!f() && Date.now() - t < ms) await sleep(50);
  return f();
};

// every log line, to prove the token never reaches one
const logs: string[] = [];
for (const k of ["log", "error", "warn"] as const) {
  const orig = console[k].bind(console);
  console[k] = (...a: unknown[]) => (logs.push(a.map(String).join(" ")), orig(...a));
}

/* ------------------------------------------------------------------ the stub api.telegram.org */

type Button = { text: string; callback_data: string };
type Msg = { id: number; chat: string; text: string; keyboard: Button[][]; edits: number };
type StubBody = { offset?: number; timeout?: number; chat_id?: string | number; text?: string; message_id?: number; reply_markup?: { inline_keyboard?: Button[][] } };
type Call = { method: string; path: string; body: StubBody };
type Update = { update_id: number } & Record<string, unknown>;
const calls: Call[] = [];
const msgs = new Map<number, Msg>();
const queue: Update[] = [];
let uid = 500;
let mid = 1000;
let inMid = 1;
const stub = createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", async () => {
    const body = JSON.parse(b || "{}") as StubBody;
    const method = (req.url ?? "").split("/").pop() ?? "";
    const ok = (result: unknown) => (res.setHeader("content-type", "application/json"), res.end(JSON.stringify({ ok: true, result })));
    if (method === "getUpdates") {
      const off = Number(body.offset ?? 0);
      const t = Date.now();
      while (!queue.some((u) => u.update_id >= off) && Date.now() - t < Math.min(1000, Number(body.timeout ?? 0) * 1000)) await sleep(30);
      calls.push({ method, path: req.url ?? "", body });
      return ok(queue.filter((u) => u.update_id >= off));
    }
    calls.push({ method, path: req.url ?? "", body });
    if (method === "sendMessage") {
      const m: Msg = { id: ++mid, chat: String(body.chat_id), text: body.text ?? "", keyboard: body.reply_markup?.inline_keyboard ?? [], edits: 0 };
      msgs.set(m.id, m);
      return ok({ message_id: m.id, chat: { id: Number(body.chat_id) }, text: body.text });
    }
    if (method === "editMessageText") {
      const m = msgs.get(Number(body.message_id));
      if (!m) return res.end(JSON.stringify({ ok: false, description: "Bad Request: message to edit not found" }));
      if (m.text === body.text && JSON.stringify(m.keyboard) === JSON.stringify(body.reply_markup?.inline_keyboard ?? [])) return (res.statusCode = 400), res.end(JSON.stringify({ ok: false, description: "Bad Request: message is not modified" }));
      Object.assign(m, { text: body.text, keyboard: body.reply_markup?.inline_keyboard ?? [], edits: m.edits + 1 });
      return ok({ message_id: m.id, text: m.text });
    }
    return ok(true);
  });
});
await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
process.env.NIMBUS_TELEGRAM_API_BASE = `http://127.0.0.1:${(stub.address() as { port: number }).port}`;

const OWNER = "4242";
const say = (text: string, chat = OWNER) => queue.push({ update_id: ++uid, message: { message_id: ++inMid, chat: { id: Number(chat) }, text } });
const tap = (m: Msg, data: string) => queue.push({ update_id: ++uid, callback_query: { id: `cb-${uid}`, from: { id: Number(OWNER) }, message: { message_id: m.id, chat: { id: Number(OWNER) }, text: m.text }, data } });
const sentTo = (chat: string) => calls.filter((c) => c.method === "sendMessage" && String(c.body.chat_id) === chat);
const lastTo = (chat: string) => sentTo(chat).at(-1)?.body.text as string | undefined;
/** the reply to the next command: the first message sent after it */
async function ask(text: string): Promise<string> {
  const n = sentTo(OWNER).length;
  say(text);
  await waitFor(() => sentTo(OWNER).length > n);
  return sentTo(OWNER)[n]?.body.text ?? "";
}
const cardsOf = (runId: string, kind: "a" | "q" = "a") => [...msgs.values()].filter((m) => m.chat === OWNER && m.text.includes(`?run=${runId}`) && (m.keyboard.length > 0 || m.edits > 0) && (kind === "a" ? /needs your OK/.test(m.text) : / asks: /.test(m.text)));
const pendingIds = (run: RunHandle) => run.events.filter((e) => e.type === "approval.request").map((e) => (e.type === "approval.request" ? e.payload.approvalId : ""));
const byTelegram = (run: RunHandle) => run.events.filter((e) => e.type === "approval.resolve" && e.payload.by === "telegram");
const dataOf = (m: Msg, suffix: string) => m.keyboard.flat().find((b) => b.callback_data.endsWith(suffix))?.callback_data ?? "";
const tools = (id: string) => WORKSTREAMS.find((w) => w.id === id)!.tools;

check("the poller starts with only the token set (pairing needs no chat id)", startTelegram());

console.log("· Pairing and privacy");
{
  say("/start", "777");
  await waitFor(() => sentTo("777").length > 0);
  check("/start while NIMBUS_TELEGRAM_CHAT_ID is unset logs the chat id to the server log", logs.some((l) => l.includes("NIMBUS_TELEGRAM_CHAT_ID=777")), logs.join("\n"));
  check("…and tells that chat it is not paired; nothing else is served", /not paired/.test(lastTo("777") ?? "") && !liveRuns().length, lastTo("777"));
  process.env.NIMBUS_TELEGRAM_CHAT_ID = OWNER;
  say("run morning brief", "999");
  await waitFor(() => sentTo("999").length > 0);
  await sleep(300);
  check("a stranger's chat gets exactly one line: the private notice, and no run starts", sentTo("999").length === 1 && lastTo("999") === PRIVATE_TEXT && !liveRuns().length, JSON.stringify(sentTo("999").map((c) => c.body.text)));
  check("requests go to /bot<token>/<method>", calls.some((c) => c.path.endsWith("/bot123456:TEST-TOKEN/sendMessage")));
  check("commands normalise: /run@Bot morning brief → run morning brief, /status@Bot → /status", normalize("/run@NimbusBot morning brief") === "run morning brief" && normalize("/status@NimbusBot") === "/status" && normalize("hello") === "hello");
}

console.log("· /help and /status through the intent router");
{
  const help = await ask("/help");
  check("/help answers with example lines", /run morning brief/.test(help) && /what needs me/.test(help), help);
  const st = await ask("/status");
  check("/status with nothing going: 'Nothing is running or waiting.'", /^Nothing is running or waiting\./.test(st), st);
}

console.log("· A scheduled run messages you first");
let cron: RunHandle;
{
  const n0 = calls.filter((c) => c.method === "getUpdates").length;
  const inbound = uid;
  cron = startRun({ workstreamId: "ws-brief", title: "Morning brief", goal: "Brief me", trigger: "cron", mode: "auto-low", tools: tools("ws-brief") });
  await waitFor(() => cardsOf(cron.id).length >= 3);
  const cards = cardsOf(cron.id);
  check("a cron run (startRun, trigger cron) pushes its approval cards with no incoming message", cards.length === 3 && uid === inbound && calls.filter((c) => c.method === "getUpdates").length >= n0, `${cards.length} cards`);
  check("each card has three buttons: Approve · Always allow · Reject", cards.every((m) => m.keyboard.length === 1 && m.keyboard[0].map((b) => b.text).join("|") === "Approve|Always allow|Reject"), JSON.stringify(cards.map((m) => m.keyboard)));
  check("each card names what waits, plain text, the run link, under 900 characters", cards.every((m) => /^Morning brief needs your OK: /.test(m.text) && m.text.includes(`https://nimbus.test/?run=${cron.id}`) && m.text.length <= 900 && !/[*`#]/.test(m.text)), cards[0]?.text);
  check("callback data fits Telegram's 64 bytes", cards.every((m) => m.keyboard.flat().every((b) => Buffer.byteLength(b.callback_data) <= 64)));
  const tg = (await (await getDb()).select().from(schema.chatThreads)).find((t) => t.key === `tg:${OWNER}`);
  check("the announced approval is recorded in chat_threads (a typed 'approve' finds it)", tg?.pendingApprovalId?.startsWith(`${cron.id}:ap-`) === true, JSON.stringify(tg));

  const st = await ask("/status");
  check("/status lists the waiting run with its link, numbers first", /^1 needs you · 0 running/.test(st) && st.includes("Morning brief") && st.includes(`https://nimbus.test/?run=${cron.id}`), st);

  const [c1, c2, c3] = cards;
  const answered = () => calls.filter((c) => c.method === "answerCallbackQuery").length;
  const a0 = answered();
  tap(c1, dataOf(c1, ":y"));
  await waitFor(() => byTelegram(cron).length === 1 && /Approved via telegram/.test(c1.text));
  check("tap Approve: the callback is answered, the approval resolves 'by telegram'", answered() === a0 + 1 && byTelegram(cron).length === 1, `${answered() - a0} answers`);
  check("…and the card is edited to show the decision, buttons removed", /Approved via telegram\./.test(c1.text) && c1.keyboard.length === 0, `${c1.text} ${JSON.stringify(c1.keyboard)}`);

  tap(c2, dataOf(c2, ":n"));
  await waitFor(() => /one line of note/.test(c2.text));
  check("tap Reject: the card asks for one line of note or /skip, buttons removed, nothing decided yet", /Reject: reply with one line of note, or \/skip\./.test(c2.text) && c2.keyboard.length === 0 && byTelegram(cron).length === 1, c2.text);
  const sk = await ask("/skip");
  await waitFor(() => /Rejected via telegram/.test(c2.text));
  check("/skip rejects with no note; the card says 'Rejected via telegram'", /^Rejected\.$/.test(sk) && /Rejected via telegram\.$/.test(c2.text) && cron.events.some((e) => e.type === "approval.resolve" && e.payload.decision === "rejected" && e.payload.by === "telegram" && !e.payload.note), `${sk} | ${c2.text}`);

  const typed = await ask("approve");
  await waitFor(() => /Approved via telegram/.test(c3.text));
  check("a typed 'approve' goes through the same router and also settles the card", /^Approved: /.test(typed) && /Approved via telegram\./.test(c3.text) && c3.keyboard.length === 0, `${typed} | ${c3.text}`);
  await cron.settled;
  await waitFor(() => /^Morning brief finished\./.test(lastTo(OWNER) ?? ""), 5000);
  const end = lastTo(OWNER) ?? "";
  check("run end: the document's first lines and the deep link, ≤ 900 characters, at most 8 lines", /^Morning brief finished\./.test(end) && end.trim().endsWith(`https://nimbus.test/?run=${cron.id}`) && end.length <= 900 && end.split("\n").length <= 8, end);
}

console.log("· /run morning brief from Telegram");
let tgRun: RunHandle | undefined;
{
  const mid0 = mid;
  say("/run morning brief");
  await waitFor(() => !!(tgRun = liveRuns().find((r) => r.workstreamId === "ws-brief" && r.events[0]?.type === "run.start" && r.events[0].payload.trigger === "telegram")));
  check("/run morning brief starts the Morning brief with trigger 'telegram'", !!tgRun, liveRuns().map((r) => r.workstreamId).join(","));
  const run = tgRun!;
  await waitFor(() => cardsOf(run.id).length >= 3);
  const progressMsgs = [...msgs.values()].filter((m) => m.id > mid0 && m.chat === OWNER && /^Morning brief · /.test(m.text));
  const pmsg = progressMsgs[0];
  check("one progress message, plain text, lane by lane with the running cost", !!pmsg && progressMsgs.length === 1 && /^Morning brief · (planning|running|waits for your OK|asks you) · \$\d/.test(pmsg.text) && /\n• \w+/.test(pmsg.text), progressMsgs.map((m) => m.text).join("\n---\n"));
  const cards = cardsOf(run.id);
  check("its approvals arrive as cards with the three buttons", cards.length === 3 && cards.every((m) => m.keyboard[0]?.length === 3));
  check("while it waits the progress message says who waits for your OK", await waitFor(() => /waits for your OK/.test(pmsg?.text ?? ""), 3000), pmsg?.text);

  const [c1, c2, c3] = cards;
  tap(c1, dataOf(c1, ":al"));
  await waitFor(() => /always allow saved/.test(c1.text));
  check("tap Always allow: approved, the policy is saved, the card says so", /Approved via telegram · always allow saved\./.test(c1.text) && run.events.some((e) => e.type === "policy") && run.events.some((e) => e.type === "approval.resolve" && e.payload.always && e.payload.by === "telegram"), c1.text);
  tap(c2, dataOf(c2, ":n"));
  await waitFor(() => /one line of note/.test(c2.text));
  const noted = await ask("too formal, keep it short");
  await waitFor(() => /Rejected via telegram/.test(c2.text));
  check("tap Reject, then one line: rejected with that note, on the run and on the card", /Noted: "too formal, keep it short"/.test(noted) && run.events.some((e) => e.type === "approval.resolve" && e.payload.decision === "rejected" && e.payload.note === "too formal, keep it short" && e.payload.by === "telegram") && /Rejected via telegram: "too formal, keep it short"\./.test(c2.text), `${noted} | ${c2.text}`);
  tap(c3, dataOf(c3, ":y"));
  await run.settled;
  await waitFor(() => /^Morning brief · done/.test(pmsg?.text ?? "") && /^Morning brief finished\./.test(lastTo(OWNER) ?? ""), 5000);
  const end = lastTo(OWNER) ?? "";
  check("tap Approve on the last card: the run finishes and the end message carries the link", /^Morning brief finished\./.test(end) && end.includes(`https://nimbus.test/?run=${run.id}`) && end.length <= 900, end);
  check("the progress message was edited in place (never a flood) and ends 'done'", !!pmsg && pmsg.edits >= 2 && /^Morning brief · done · \$\d/.test(pmsg.text) && progressMsgs.length === 1, `${pmsg?.edits} edits: ${pmsg?.text}`);
  const view = buildView(run.events as AnyRunEvent[]);
  const items = view.transcript.filter((i) => i.t === "approval");
  check("the web timeline: trigger 'telegram' and every decision 'by telegram'", view.trigger === "telegram" && items.length === 3 && items.every((i) => i.t === "approval" && i.by === "telegram"), JSON.stringify(items.map((i) => (i.t === "approval" ? i.by : ""))));
  const row = (await (await getDb()).select().from(schema.runs)).find((r) => r.id === run.id);
  check("the runs table records trigger 'telegram' (the run list badge)", row?.trigger === "telegram", row?.trigger);
}

console.log("· A crew question answered by button");
{
  say("/run ship nimbus");
  let run: RunHandle | undefined;
  await waitFor(() => !!(run = liveRuns().find((r) => r.workstreamId === "ws-ship-nimbus")));
  await waitFor(() => cardsOf(run!.id, "q").length > 0);
  const q = cardsOf(run!.id, "q")[0];
  const opts = q?.keyboard.flat() ?? [];
  check("the question arrives with its options as buttons", !!q && opts.length >= 2 && opts.every((b) => b.callback_data.startsWith(`q:${run!.id}:q-`)), q?.text);
  const pick = opts[0]?.text ?? "";
  tap(q, opts[0]?.callback_data ?? "");
  await waitFor(() => /Answered via telegram/.test(q.text));
  const ans = run!.events.find((e) => e.type === "message" && e.payload.answerTo);
  check("the tap posts that option to the asking lane, marked via telegram; the card shows it", ans?.type === "message" && ans.payload.via === "telegram" && ans.payload.text.startsWith(pick.replace(/…$/, "")) && /Answered via telegram: /.test(q.text) && q.keyboard.length === 0, `${JSON.stringify(ans?.payload)} | ${q.text}`);
  check("the web timeline shows the answer 'via telegram'", buildView(run!.events as AnyRunEvent[]).transcript.some((i) => i.t === "user" && i.via === "telegram"));
  // the rest of the run: approve whatever it asks
  const t = Date.now();
  while (!run!.finished && Date.now() - t < 20_000) {
    for (const m of cardsOf(run!.id)) {
      if (!m.keyboard.length) continue;
      tap(m, dataOf(m, ":y"));
      m.keyboard = []; // tapped once; the card's edit arrives a moment later
    }
    await sleep(200);
  }
  await run!.settled.catch(() => {});
  check("…and the run goes on to finish, approved from Telegram", run!.events.some((e) => e.type === "run.end") && pendingIds(run!).length > 0 && byTelegram(run!).length === pendingIds(run!).length, `${byTelegram(run!).length}/${pendingIds(run!).length}`);
}

console.log("· One poller per database");
{
  check("while this process polls, a second claimant is refused (it would double-handle updates)", (await claimPoller("other-server")) === null);
  const [row] = await (await getDb()).select().from(schema.telegramPoller);
  check("the next update offset is persisted in telegram_poller", row?.updateOffset === uid + 1, `${row?.updateOffset} vs ${uid + 1}`);
  await stopTelegram();
  const n = calls.filter((c) => c.method === "getUpdates").length;
  await sleep(400);
  check("after stop no more getUpdates, and the row is free for the next process", calls.filter((c) => c.method === "getUpdates").length === n && (await claimPoller("other-server"))?.offset === uid + 1);
}

check("no log line ever contains the bot token", !logs.join("\n").includes("TEST-TOKEN"));
check("only the owner's chat got anything beyond one line", sentTo("777").length === 1 && sentTo("999").length === 1 && calls.filter((c) => c.method === "sendMessage").every((c) => ["777", "999", OWNER].includes(String(c.body.chat_id))));
const secs = (Date.now() - T0) / 1000;
check(`the whole check runs in under 60 s (${secs.toFixed(1)} s)`, secs < 60);

if (process.env.NIMBUS_CHECK_DUMP === "1") for (const m of msgs.values()) console.log(`\n#${m.id} → ${m.chat} (${m.edits} edits)${m.keyboard.length ? ` [${m.keyboard.flat().map((b) => b.text).join(" · ")}]` : ""}\n${m.text}`);
for (const run of liveRuns()) run.stop("cancel");
stub.close();
const pass = checks.every(([, ok]) => ok);
console.log(`\nTELEGRAM CHECK: ${pass ? "PASS" : "FAIL"} (${checks.filter(([, ok]) => ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
