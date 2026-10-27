// Chat apps in mock mode ($0, no server, no real bot): docs/CHAT-APPS.md Phase A and B.
// The route handler is called directly with Requests; Telegram is a local stub standing in for api.telegram.org.
//   pnpm check:chat
process.env.NIMBUS_DATA_DIR = "./data/check-chat"; // own database; .env.local already names ./data
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_SCHEDULER = "off";
process.env.NIMBUS_V1_LOG = "1";
process.env.NIMBUS_PUBLIC_URL = "https://nimbus.test";
process.env.NIMBUS_API_TOKEN = "secret-token-123";
process.env.NIMBUS_CHAT_QUESTION_WAIT_MS = "1500";
process.env.NIMBUS_NOTIFY_BATCH_MS = "400";
import { createServer } from "node:http";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { dataDir, getDb, schema } from "../src/db";
import { buildView } from "../src/lib/run-view";
import type { AnyRunEvent } from "../src/lib/events";
import { POST } from "../src/app/v1/chat/completions/route";
import { GET as MODELS } from "../src/app/v1/models/route";
import { sseResponse, type ChatBody } from "../src/runtime/chat-api";
import { toPhone } from "../src/runtime/chat-util";
import { ruleIntent, threadKey } from "../src/runtime/chat";
import { getRun, liveRuns, startRun } from "../src/runtime/source";
import { WORKSTREAMS } from "../src/lib/workstreams";

rmSync(dataDir(), { recursive: true, force: true });
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail.replace(/\n/g, "\n    ")}` : ""}`));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TOKEN = process.env.NIMBUS_API_TOKEN!;

type Reply = { text: string; intent: string; runId?: string; url?: string; status: number; json: any };
/** one chat message, the way a client sends it: non-stream JSON */
async function say(text: string, o: { model?: string; user?: string; extra?: Partial<ChatBody> } = {}): Promise<Reply> {
  const body: ChatBody = { model: o.model ?? "nimbus", messages: [{ role: "system", content: "You are a chat assistant." }, { role: "user", content: text }], user: o.user ?? "harry", ...o.extra };
  const res = await POST(new Request("http://localhost:3241/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body) }));
  const json: any = await res.json();
  return { text: json.choices?.[0]?.message?.content ?? json.error?.message ?? "", intent: json.nimbus?.intent, runId: json.nimbus?.run_id, url: json.nimbus?.url, status: res.status, json };
}
const dbRuns = async () => (await (await getDb()).select().from(schema.runs)).length;
const thread = async (user = "harry") => {
  const key = threadKey(TOKEN, { model: "nimbus", messages: [{ role: "system", content: "You are a chat assistant." }, { role: "user", content: "x" }], user });
  return (await (await getDb()).select().from(schema.chatThreads)).find((t) => t.key === key);
};
const byChat = (runId: string) => (getRun(runId)?.events ?? []).filter((e) => e.type === "approval.resolve" && e.payload.by === "chat").length;

console.log("— Models and compatibility (A2)");
{
  const models = (await (await MODELS()).json()).data.map((m: { id: string }) => m.id);
  check("/v1/models lists `nimbus` first and still every nimbus/<slug>", models[0] === "nimbus" && WORKSTREAMS.every((w) => models.includes(`nimbus/${w.slug}`)), models.join(","));
  const r1 = await say("help", { extra: { tools: [{ type: "function", function: { name: "web_search" } }], tool_choice: "auto", response_format: { type: "json_object" } } });
  check("tools, tool_choice and response_format are accepted and ignored (text, finish_reason stop)", r1.status === 200 && r1.json.choices[0].finish_reason === "stop" && r1.json.choices[0].message.role === "assistant" && typeof r1.text === "string" && r1.text.length > 0);
  const r2 = await POST(new Request("http://x/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ model: "nimbus", user: "parts", messages: [{ role: "system", content: [{ type: "text", text: "sys" }] }, { role: "user", content: "earlier question" }, { role: "assistant", content: "earlier answer" }, { role: "tool", content: "tool output", tool_call_id: "c1" }, { role: "user", content: [{ type: "text", text: "he" }, { type: "text", text: "lp" }] }] }) }));
  const j2: any = await r2.json();
  check("roles system, user, assistant, tool and content parts: the last user message is read from its parts ('he'+'lp' = help)", r2.status === 200 && j2.nimbus.intent === "help", JSON.stringify(j2).slice(0, 200));
  const bad = await POST(new Request("http://x/v1/chat/completions", { method: "POST", headers: { authorization: "Bearer wrong" }, body: JSON.stringify({ model: "nimbus", messages: [{ role: "user", content: "hi" }] }) }));
  check("a wrong bearer token is a 401 in OpenAI error shape", bad.status === 401 && (await bad.json()).error?.type === "invalid_request_error");
  const none = await POST(new Request("http://x/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ model: "nimbus", messages: [{ role: "system", content: "s" }] }) }));
  check("no user message is a 400", none.status === 400);
}

console.log("— Streaming (A2)");
{
  const t0 = Date.now();
  const res = await POST(new Request("http://x/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ model: "nimbus", user: "stream", stream: true, stream_options: { include_usage: true }, messages: [{ role: "user", content: "what's running?" }] }) }));
  const reader = res.body!.getReader();
  const first = await reader.read();
  const firstMs = Date.now() - t0;
  let raw = new TextDecoder().decode(first.value);
  for (;;) {
    const n = await reader.read();
    if (n.done) break;
    raw += new TextDecoder().decode(n.value);
  }
  const frames = raw.split("\n\n").filter(Boolean);
  const datas = frames.filter((f) => f.startsWith("data: ") && !f.startsWith("data: [DONE]")).map((f) => JSON.parse(f.slice(6)));
  check("content-type is text/event-stream; the first byte arrives within 2 s", res.headers.get("content-type")?.startsWith("text/event-stream") === true && firstMs < 2000, `${firstMs} ms`);
  check("every frame is exactly `data: {json}` followed by a blank line; the last is `data: [DONE]`", frames.every((f) => f.startsWith("data: ") || f.startsWith(":")) && raw.endsWith("data: [DONE]\n\n"));
  check("first chunk carries the assistant role; the last content chunk has finish_reason stop", datas[0].choices[0].delta.role === "assistant" && datas.filter((d) => d.choices.length).at(-1).choices[0].finish_reason === "stop");
  const usageChunk = datas.at(-1);
  check("stream_options.include_usage: a final chunk with empty choices and a usage block", usageChunk.choices.length === 0 && typeof usageChunk.usage?.total_tokens === "number");
  const text = datas.map((d) => d.choices[0]?.delta?.content ?? "").join("");
  check("the streamed text is the reply", /Nothing is running/.test(text), text);
  const plain = await POST(new Request("http://x/v1/chat/completions", { method: "POST", headers: { authorization: `Bearer ${TOKEN}` }, body: JSON.stringify({ model: "nimbus", user: "stream", stream: true, messages: [{ role: "user", content: "help" }] }) }));
  const praw = await plain.text();
  check("without include_usage there is no usage chunk", !praw.split("\n\n").some((f) => f.startsWith("data: {") && JSON.parse(f.slice(6)).choices.length === 0));

  // heartbeat: a slow reply, a 150 ms beat
  process.env.NIMBUS_V1_HEARTBEAT_MS = "150";
  async function* slow() {
    await sleep(700);
    yield "late";
  }
  const hb = await sseResponse({ id: "x", model: "nimbus", pieces: slow(), usage: () => ({ prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }) }, false).text();
  delete process.env.NIMBUS_V1_HEARTBEAT_MS;
  check("a slow reply gets SSE comment heartbeats (`: keep-alive`) and still ends with [DONE]", (hb.match(/^: keep-alive$/gm) ?? []).length >= 3 && hb.endsWith("data: [DONE]\n\n"), hb.slice(0, 200));
}

console.log("— Request log (A1)");
{
  const dir = path.join(dataDir(), "v1-log");
  const files = readdirSync(dir);
  const all = files.map((f) => readFileSync(path.join(dir, f), "utf8")).join("\n");
  check("NIMBUS_V1_LOG=1 wrote one file per request", files.length >= 5, String(files.length));
  check("the bearer token appears in none of them; the body does", !all.includes(TOKEN) && !/authorization/i.test(all) && all.includes("earlier question"));
}

console.log("— Intents by rule (A3)");
{
  const none = { approval: false, question: false };
  const n = (t: string, c = none) => ruleIntent(t, c)?.name ?? "—";
  check("help: help, /start, hi", ["help", "/start", "hi", "Hello!"].every((t) => n(t) === "help"));
  check("status: what's running? / what needs me? / anything waiting", ["what's running?", "What needs me?", "anything waiting", "status"].every((t) => n(t) === "status"));
  check("approve: approve, yes, ok send it, looks good, approve all", ["approve", "Yes", "ok send it", "looks good", "approve all"].every((t) => n(t) === "approve"));
  const d = ruleIntent("deny: too long", none);
  check("deny: 'deny: too long' carries the note; 'no' has none", n("no") === "deny" && d?.name === "deny" && d.note === "too long" && ruleIntent("reject, wrong tone", none)?.note === "wrong tone");
  check("answer: with a question waiting, '2', free text and even 'yes' answer it; 'approve' still goes to an approval when both wait", n("2", { approval: false, question: true }) === "answer" && n("yes", { approval: false, question: true }) === "answer" && n("Use the router", { approval: false, question: true }) === "answer" && n("approve", { approval: true, question: true }) === "approve");
  check("run: 'run morning brief', 'check the repo', 'morning brief'", ruleIntent("run morning brief", none)?.ws?.slug === "morning-brief" && ruleIntent("check the repo", none)?.name === "run" && ruleIntent("morning brief", none)?.name === "run");
  check("ask: a question about past work picks its workstream", ruleIntent("what did the radar find today?", none)?.name === "ask" && ruleIntent("what did the radar find today?", none)?.ws?.slug === "hackathon-radar" && ruleIntent("How much did the audit save?", none)?.ws?.slug === "cost-audit");
  check("something no rule places goes to the classifier (mock: ask)", n("fancy a chat about something") === "—");
  const c = await say("fancy a chat about something");
  check("…and is answered as `ask` (classifier path, no run)", c.intent === "ask" && c.status === 200, c.intent);
}

console.log("— No answer in time (A6)");
const quiet = await say("run ship nimbus", { user: "quiet" });
check("a second question is announced", /asks: /.test(quiet.text), quiet.text);
await sleep(2200);
const qEvents = getRun(quiet.runId!)!.events;
check("after the wait the crew's old behaviour applies: the last option is chosen, flagged 'auto' on the run", qEvents.some((e) => e.type === "message" && e.payload.via === "auto"));
const late = await say("1", { user: "quiet" });
check("a late '1' is told what happened instead of starting anything", /picked/.test(late.text) || /Nothing is waiting/.test(late.text), late.text);
getRun(quiet.runId!)!.stop("cancel");
await getRun(quiet.runId!)!.settled.catch(() => {});

console.log("— A conversation: run, approve, ask, status (A3–A5)");
const runs0 = await dbRuns();
const t0 = Date.now();
const brief = await say("run morning brief");
check("'run morning brief' starts the Morning brief and answers within seconds", brief.intent === "run" && /^On it: Morning brief\./.test(brief.text) && Date.now() - t0 < 30_000, brief.text);
check("the reply stops at the approval: 'Needs your OK', 'Reply approve or deny', the run link from NIMBUS_PUBLIC_URL", /Needs your OK: /.test(brief.text) && /Reply approve or deny\./.test(brief.text) && brief.text.trim().endsWith(`https://nimbus.test/?run=${brief.runId}`), brief.text);
check("it names the other two replies waiting", /2 more waiting/.test(brief.text), brief.text);
check("the reply is plain text and fits a phone (≤ 900 characters)", brief.text.length <= 900 && !/[#*`|]/.test(brief.text), String(brief.text.length));
const th = await thread();
check("chat_threads holds last_run_id and pending_approval_id as `<run>:<approval>`", th?.lastRunId === brief.runId && th?.pendingApprovalId?.startsWith(`${brief.runId}:ap-`) === true, JSON.stringify(th));
check("the run is tagged `chat` and waits", getRun(brief.runId!)?.events.find((e) => e.type === "run.start")?.payload && (getRun(brief.runId!)!.events[0] as any).payload.trigger === "chat" && !getRun(brief.runId!)!.finished);

const st = await say("what needs me?");
check("'what needs me?' lists the waiting run with its link, numbers first", st.intent === "status" && /^1 needs you · 0 running/.test(st.text) && st.text.includes("Morning brief") && st.text.includes(`https://nimbus.test/?run=${brief.runId}`), st.text);

const before = await dbRuns();
const ask = await say("what did the radar find today?");
check("'what did the radar find today?' answers from the radar's latest document, with no new run", ask.intent === "ask" && /Bridge Bot|MIT|312/.test(ask.text) && /From Hackathon radar/.test(ask.text) && (await dbRuns()) === before && !ask.runId, ask.text);
check("…in phone length", ask.text.length <= 900 && ask.text.split("\n").length <= 8, `${ask.text.length} chars`);

const a1 = await say("approve");
check("'approve' resolves the announced approval and says so; two still wait", a1.intent === "approve" && /^Approved: /.test(a1.text) && /2 more waiting/.test(a1.text) && byChat(brief.runId!) === 1, a1.text);
const a2 = await say("approve all");
await getRun(brief.runId!)!.settled;
check("'approve all' resolves the rest, the run continues, and the final text arrives with the link", a2.intent === "approve" && byChat(brief.runId!) === 3 && /https:\/\/nimbus\.test\/\?run=/.test(a2.text) && getRun(brief.runId!)!.finished && a2.text.length <= 900, a2.text);
const view = buildView(getRun(brief.runId!)!.events as AnyRunEvent[]);
const apprItems = view.transcript.filter((i) => i.t === "approval");
check("the run's own timeline records all three as approved via chat", apprItems.length === 3 && apprItems.every((i) => i.t === "approval" && i.status === "approved" && i.by === "chat"), JSON.stringify(apprItems.map((i) => (i.t === "approval" ? i.by : ""))));
check("a repeat 'approve' with nothing waiting says so (no run is started)", (await say("approve")).text.startsWith("Nothing is waiting"));

console.log("— Questions and deny (A3, A6)");
const ship = await say("run ship nimbus");
check("the crew's question comes to chat with numbered options, how to reply, and the fallback", ship.intent === "run" && /asks: /.test(ship.text) && /\n1\) /.test(ship.text) && /\n2\) /.test(ship.text) && /Reply 1-2 or type an answer\./.test(ship.text) && /crew picks/.test(ship.text), ship.text);
const th2 = await thread();
check("chat_threads holds pending_question_id", th2?.pendingQuestionId?.startsWith(`${ship.runId}:q-`) === true, JSON.stringify(th2));
const ans = await say("1");
check("'1' picks option 1: the question is answered 'via chat' and the run goes on to its approval", ans.intent === "answer" && /^Answered /.test(ans.text) && /Needs your OK: /.test(ans.text), ans.text);
check("the run's transcript marks that answer 'via chat'", buildView(getRun(ship.runId!)!.events as AnyRunEvent[]).transcript.some((i) => i.t === "user" && i.via === "chat"));
const den = await say("deny: too risky");
check("'deny: too risky' rejects the pending approval with the note", den.intent === "deny" && /^Rejected: /.test(den.text) && /too risky/.test(den.text), den.text);
await getRun(ship.runId!)!.settled.catch(() => {});
check("the rejection and its note are in the run", getRun(ship.runId!)!.events.some((e) => e.type === "approval.resolve" && e.payload.decision === "rejected" && e.payload.by === "chat" && e.payload.note === "too risky"));

console.log("— Phone formatting (A5)");
{
  const md = "# Heading\n\n**Bold** line with `code` and [a link](https://x.test).\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n- one\n- two\n- three\n- four\n- five\n- six\n- seven\n" + "word ".repeat(400);
  const p = toPhone(md);
  check("markdown becomes plain lines: no #, **, backticks, table rules; table rows joined", !/[#*`]|---/.test(p) && p.includes("1 · 2") && p.includes("a link (https://x.test)"), p);
  check("long docs: at most 6 lines and 900 characters, with an ellipsis", p.split("\n").length <= 6 && p.length <= 900 && p.endsWith("…"), `${p.split("\n").length} lines ${p.length} chars`);
  check("the thread key is stable for the same token+user and differs per user", threadKey("t", { user: "a", messages: [] }) === threadKey("t", { user: "a", messages: [] }) && threadKey("t", { user: "a", messages: [] }) !== threadKey("t", { user: "b", messages: [] }));
  const sys = (s: string, u: string): ChatBody => ({ messages: [{ role: "system", content: s }, { role: "user", content: u }] });
  check("without a `user` field the key comes from the system prompt + first user message", threadKey("t", sys("s", "u1")) === threadKey("t", sys("s", "u1")) && threadKey("t", sys("s", "u1")) !== threadKey("t", sys("s2", "u1")));
}

console.log("— Per-workstream models keep working");
{
  const r = await say("go", { model: "nimbus/hackathon-radar" });
  check("nimbus/hackathon-radar starts that workstream whatever the message says", r.intent === "run" && !!r.runId && getRun(r.runId)!.workstreamId === "ws-radar", r.text.slice(0, 120));
}

// ---------------------------------------------------------------- Phase B: Nimbus messages you first
console.log("— Telegram, send only (B)");
type Sent = { path: string; body: { chat_id: string; text: string } };
const sent: Sent[] = [];
const stub = createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    sent.push({ path: req.url ?? "", body: JSON.parse(b || "{}") });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, result: { message_id: sent.length } }));
  });
});
await new Promise<void>((r) => stub.listen(0, "127.0.0.1", r));
const stubPort = (stub.address() as { port: number }).port;
process.env.NIMBUS_TELEGRAM_API_BASE = `http://127.0.0.1:${stubPort}`;
process.env.NIMBUS_TELEGRAM_BOT_TOKEN = "123456:TEST-TOKEN";
process.env.NIMBUS_TELEGRAM_CHAT_ID = "4242";
const waitFor = async (f: () => boolean, ms = 15_000) => {
  const t = Date.now();
  while (!f() && Date.now() - t < ms) await sleep(50);
  return f();
};
{
  const cronRun = startRun({ workstreamId: "ws-brief", title: "Morning brief", goal: "Brief me", trigger: "cron", mode: "auto-low", tools: WORKSTREAMS.find((w) => w.id === "ws-brief")!.tools });
  await waitFor(() => sent.length > 0);
  await sleep(1200); // anything else that would have arrived by now
  check("a cron run hits its approvals: the stub receives exactly one message (the three replies batched)", sent.length === 1, `${sent.length} messages`);
  const m = sent[0];
  check("it goes to /bot<token>/sendMessage with the chat id, and says what waits and how to answer", m?.path === "/bot123456:TEST-TOKEN/sendMessage" && m.body.chat_id === "4242" && /^Morning brief needs your OK on 3 things:/.test(m.body.text) && /Reply approve \(or approve all\) or deny\./.test(m.body.text) && m.body.text.includes(`https://nimbus.test/?run=${cronRun.id}`), JSON.stringify(m));
  const tg = (await (await getDb()).select().from(schema.chatThreads)).find((t) => t.key === "tg:4242");
  check("the announced approval is recorded in chat_threads under the Telegram chat", tg?.lastRunId === cronRun.id && tg?.pendingApprovalId?.startsWith(`${cronRun.id}:ap-`) === true, JSON.stringify(tg));

  // the reply arrives through a chat app (OpenClaw), a different conversation from the one that was pushed
  const r1 = await say("approve", { user: "openclaw-telegram-4242" });
  check("'approve' from another conversation resolves the pushed approval (announced items are found across chats)", r1.intent === "approve" && /^Approved: /.test(r1.text) && byChat(cronRun.id) === 1, r1.text);
  const r2 = await say("approve all", { user: "openclaw-telegram-4242" });
  await cronRun.settled;
  check("…and the rest; the web timeline shows every approval 'approved via chat'", byChat(cronRun.id) === 3 && buildView(cronRun.events as AnyRunEvent[]).transcript.filter((i) => i.t === "approval").every((i) => i.t === "approval" && i.by === "chat"), r2.text);
  check("a run that a chat request is following does not also message Telegram (no duplicate at the end)", sent.length === 1, `${sent.length}`);
}
{
  const n0 = sent.length;
  const radar = startRun({ workstreamId: "ws-radar", title: "Hackathon radar", goal: "Scan", trigger: "cron", mode: "auto-low", tools: WORKSTREAMS.find((w) => w.id === "ws-radar")!.tools });
  await radar.settled;
  await waitFor(() => sent.length > n0, 5000);
  const m = sent[n0];
  check("an unattended run that ends sends one message with the result's first lines and the link", sent.length === n0 + 1 && /^Hackathon radar finished\./.test(m.body.text) && m.body.text.includes(`https://nimbus.test/?run=${radar.id}`) && m.body.text.length <= 900, m?.body.text);
}
{
  await (await getDb()).delete(schema.memories); // run one again: the Learner of the earlier ship run taught it to skip the question
  const n0 = sent.length;
  const shipRun = startRun({ workstreamId: "ws-ship-nimbus", title: "Ship Nimbus", goal: "Ship", trigger: "cron", mode: "auto-low", tools: WORKSTREAMS.find((w) => w.id === "ws-ship-nimbus")!.tools });
  await waitFor(() => sent.length > n0);
  const m = sent[n0];
  check("a crew question is pushed with numbered options", /^Ship Nimbus: .* asks: /.test(m?.body.text ?? "") && /\n1\) /.test(m.body.text) && /Reply 1-2/.test(m.body.text), m?.body.text);
  const ans = await say("2", { user: "openclaw-telegram-4242" });
  check("'2' from the chat app answers it via chat", ans.intent === "answer" && /^Answered /.test(ans.text), ans.text);
  shipRun.stop("cancel");
  await shipRun.settled.catch(() => {});
  await sleep(600); // the "cancelled" message for the stopped cron run
}
{
  const n0 = sent.length;
  const manual = startRun({ workstreamId: "ws-radar", title: "Hackathon radar", goal: "Scan", trigger: "manual", mode: "auto-low", tools: [] });
  await manual.settled;
  await sleep(300);
  check("a run you started yourself in the web app sends nothing", sent.length === n0);
}
{
  // a dead Telegram must not hurt the run, and the token must not reach the log
  process.env.NIMBUS_TELEGRAM_API_BASE = "http://127.0.0.1:9";
  const logged: string[] = [];
  const orig = console.error;
  console.error = (...a: unknown[]) => void logged.push(a.map(String).join(" "));
  const dead = startRun({ workstreamId: "ws-radar", title: "Hackathon radar", goal: "Scan", trigger: "cron", mode: "auto-low", tools: [] });
  await dead.settled;
  await sleep(500);
  console.error = orig;
  check("with Telegram unreachable the run still finishes and the error log never contains the token", dead.events.some((e) => e.type === "run.end" && e.payload.status === "done") && logged.some((l) => /telegram/i.test(l)) && !logged.join("\n").includes("TEST-TOKEN"), logged.join("\n"));
  process.env.NIMBUS_TELEGRAM_API_BASE = `http://127.0.0.1:${stubPort}`;
}
{
  delete process.env.NIMBUS_TELEGRAM_BOT_TOKEN;
  const n0 = sent.length;
  const off = startRun({ workstreamId: "ws-radar", title: "Hackathon radar", goal: "Scan", trigger: "cron", mode: "auto-low", tools: [] });
  await off.settled;
  await sleep(300);
  check("without NIMBUS_TELEGRAM_BOT_TOKEN nothing is sent", sent.length === n0);
}

for (const run of liveRuns()) run.stop("cancel");
stub.close();
const pass = checks.every(([, ok]) => ok);
console.log(`\nCHAT CHECK: ${pass ? "PASS" : "FAIL"} (${checks.filter(([, ok]) => ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
