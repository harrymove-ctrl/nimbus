// docs/CONVERSATION.md C2 and C1 exit tests, mock mode ($0).
// C2: a finished Morning brief gets "shorter, top three only" and a continuation run (parent_run_id set) writes
// morning-brief v2 for under $0.01; "why did you skip the third email?" is answered from the run with no new run; the
// same through POST /api/runs/[id]/messages and the chat router's `followup` intent.
// C1: "watch hotel prices for my Tokyo trip" gets exactly one intake card with three questions before the plan, its
// answers become memories; "run morning brief" gets none; the vague workstream's second run asks nothing.
// Own database: the shared one is held open by the dev servers.
process.env.NIMBUS_DATA_DIR = "./data/check-followup"; // set here, not ??=: .env.local already names ./data
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_DEBUG_PROMPTS = "1";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { and, eq, like } from "drizzle-orm";
import { dataDir, getDb, schema } from "../src/db";
import type { AnyRunEvent } from "../src/lib/events";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { handleChat, ruleIntent, saveThread, threadKey } from "../src/runtime/chat";
import { followUp, followUpTitle } from "../src/runtime/followup";
import { INTAKE_HEAD, checkSlots } from "../src/runtime/intake";
import { getRun, startRun, type RunHandle, type StartRunInput } from "../src/runtime/source";
import { POST as postMessage } from "../src/app/api/runs/[id]/messages/route";

rmSync(dataDir(), { recursive: true, force: true });
const db = await getDb();
const T0 = Date.now(); // the mock seeds a demo history first; the cost line counts only this check's runs
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail?: unknown) => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${ok || detail === undefined ? "" : `\n    ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`));

/** Approve every action; answer an intake card with `intake`, any other question with its first option. Collects every question. */
function drive(run: RunHandle, intake?: string) {
  const questions: Extract<AnyRunEvent, { type: "question" }>[] = [];
  const act = (e: AnyRunEvent) => {
    if (e.type === "approval.request") setTimeout(() => run.resolveApproval(e.payload.approvalId, { decision: "approved" }), 0);
    if (e.type === "question") {
      questions.push(e);
      const text = e.payload.text.startsWith(INTAKE_HEAD) ? (intake ?? "Use your best judgment") : (e.payload.options?.[0] ?? "ok");
      setTimeout(() => run.postMessage({ kind: "answer", text, questionId: e.payload.questionId }), 0);
    }
  };
  for (const e of run.events) act(e);
  run.onEvent(act);
  return { questions, done: run.settled.then(() => questions) };
}
const go = async (input: StartRunInput, intake?: string) => {
  const run = startRun(input);
  const questions = await drive(run, intake).done;
  return { run, questions };
};
const runRow = async (id: string) => (await db.select().from(schema.runs).where(eq(schema.runs.id, id)))[0];
const runCount = async () => (await db.select({ id: schema.runs.id }).from(schema.runs)).length;
const intakeCards = (qs: Extract<AnyRunEvent, { type: "question" }>[]) => qs.filter((q) => q.payload.text.startsWith(INTAKE_HEAD));

console.log("· C2 · follow-ups on a finished run");
const brief = WORKSTREAMS.find((w) => w.id === "ws-brief")!;
const { run: r1 } = await go({ workstreamId: brief.id, title: brief.title, goal: brief.goal, trigger: "manual", tools: brief.tools });
const v1 = await db.select().from(schema.artifacts).where(and(eq(schema.artifacts.runId, r1.id), eq(schema.artifacts.artifactId, "morning-brief")));
check("the Morning brief run is done and wrote morning-brief v1", (await runRow(r1.id))?.status === "done" && v1.length === 1 && v1[0].version === 1, { status: (await runRow(r1.id))?.status, v1: v1.map((a) => a.version) });

const before = await runCount();
const q = await followUp(r1.id, "why did you skip the third email?", { via: "web" });
check("'why did you skip the third email?' is answered from the run, with no new run", q.kind === "answer" && (await runCount()) === before && /wait|invoice|digest|Reviewer/i.test(q.kind === "answer" ? q.text : ""), q.kind === "answer" ? q.text : q);
const tail = r1.events.slice(-2);
check("…and the question and its answer join the finished run's conversation, after run.end", tail.length === 2 && tail.every((e) => e.type === "message" && !!e.payload.followUp) && tail[0].type === "message" && tail[0].payload.role === "user" && r1.events.findIndex((e) => e.type === "run.end") < r1.events.length - 2);
const stored = await db.select().from(schema.runEvents).where(eq(schema.runEvents.runId, r1.id));
check("…stored too, so a reload shows them", stored.length === r1.events.length && stored.some((e) => e.type === "message" && (e.payload as { text?: string }).text === "why did you skip the third email?"));

const c = await followUp(r1.id, "shorter, top three only", { via: "web" });
if (c.kind !== "continuation") throw new Error(`expected a continuation, got ${JSON.stringify(c)}`);
await drive(c.run).done;
const child = await runRow(c.run.id);
const v2 = await db.select().from(schema.artifacts).where(and(eq(schema.artifacts.runId, c.run.id), eq(schema.artifacts.artifactId, "morning-brief")));
check("'shorter, top three only' starts a continuation run with parent_run_id set", child?.parentRunId === r1.id && child.status === "done" && (await runCount()) === before + 1, child);
check("its title reads 'Follow up: shorter, top three only'", child?.title === "Follow up: shorter, top three only" && followUpTitle("Shorter, top three only.") === "Follow up: Shorter, top three only", child?.title);
check("it writes version 2 of the same artifact (morning-brief v2)", v2.length === 1 && v2[0].version === 2 && v2[0].content.length < v1[0].content.length, v2.map((a) => a.version));
check(`it costs under $0.01 of mock cost ($${child?.costUsd.toFixed(4)})`, (child?.costUsd ?? 1) > 0 && (child?.costUsd ?? 1) < 0.01, child?.costUsd);
const startEv = c.run.events.find((e) => e.type === "run.start");
check("its run.start names the parent run and the follow-up", startEv?.type === "run.start" && startEv.payload.parentRunId === r1.id && startEv.payload.followUp === "shorter, top three only");
const prompts = readFileSync(path.join(dataDir(), "prompts", `${c.run.id}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { instance: string; user: string });
const op = prompts.find((p) => p.instance === "orchestrator")?.user ?? "";
check("its first prompt carries the parent's goal, the artifact v1 and the follow-up text", op.includes(`Goal: ${brief.goal}`) && op.includes("[morning-brief v1:") && op.includes("The person's follow-up: shorter, top three only"));
check("the parent's conversation links the continuation", r1.events.some((e) => e.type === "message" && e.payload.followUp?.continuationRunId === c.run.id));

console.log("· C2 · through POST /api/runs/[id]/messages and the chat router");
const post = (id: string, body: unknown) => postMessage(new Request(`http://x/api/runs/${id}/messages`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
const res = await post(c.run.id, { text: "why only three?", kind: "followup" });
const rj = (await res.json()) as { kind?: string; text?: string };
check("POST kind 'followup' on the finished continuation answers it (200, kind answer)", res.status === 200 && rj.kind === "answer" && !!rj.text, rj);
const res2 = await post(r1.id, { text: "add Thursday's calendar" });
const rj2 = (await res2.json()) as { kind?: string; runId?: string; title?: string };
check("POST without a kind on a finished run is a follow-up too: work → 201, a continuation", res2.status === 201 && rj2.kind === "continuation" && rj2.title === "Follow up: add Thursday's calendar", rj2);
if (rj2.runId) await getRun(rj2.runId)?.settled;
const res3 = await post("run_nope", { text: "hello" });
check("a run that does not exist → 404", res3.status === 404);

const none = { approval: false, question: false };
const fu = { approval: false, question: false, followup: true, followupWs: "ws-brief" };
check(
  "rules: a done thread makes 'shorter, top three only' a followup; 'run morning brief' stays run; another workstream's question stays ask",
  ruleIntent("shorter, top three only", fu)?.name === "followup" && ruleIntent("shorter, top three only", none)?.name !== "followup" && ruleIntent("run morning brief", fu)?.name === "run" && ruleIntent("what did the radar find today?", fu)?.name === "ask" && ruleIntent("why did you skip the third email?", fu)?.name === "followup" && ruleIntent("approve", fu)?.name === "approve",
);
const body = (text: string) => ({ model: "nimbus", user: "fu-check", messages: [{ role: "user" as const, content: text }] });
const key = threadKey("tok", body("x"));
await saveThread(key, { lastRunId: r1.id, pendingApprovalId: null, pendingQuestionId: null });
const readAll = async (t: Awaited<ReturnType<typeof handleChat>>) => {
  if ("error" in t) return { intent: "error", text: t.error.message, runId: undefined };
  let s = "";
  for await (const p of t.pieces) s += p;
  return { intent: t.intent, text: s, runId: t.runId };
};
const n0 = await runCount();
const a = await readAll(await handleChat(body("why did you skip the third email?"), { token: "tok", origin: "https://nimbus.test" }));
check("chat: a question in a thread whose last run is done is a followup, answered with the run's link and no run", a.intent === "followup" && a.runId === r1.id && a.text.includes(`?run=${r1.id}`) && (await runCount()) === n0, a);
const b = await readAll(await handleChat(body("shorter, top three only"), { token: "tok", origin: "https://nimbus.test" }));
if (b.runId) await getRun(b.runId)?.settled; // the reply ends at run.end; the row is final once the Learner is done
const bRow = b.runId ? await runRow(b.runId) : undefined;
check("chat: 'shorter, top three only' starts a linked continuation and follows it to its end", b.intent === "followup" && /^On it: Follow up: shorter, top three only\./.test(b.text) && bRow?.parentRunId === r1.id && bRow.status === "done", b);

console.log("· C1 · intake questions before a vague plan");
const vague = await checkSlots("watch hotel prices for my Tokyo trip", "");
check("the slot check finds the hotel goal missing two or more slots and asks three questions", vague.missing.length >= 2 && vague.questions.length === 3, vague);
const full = await checkSlots(brief.goal, "");
check("the Morning brief's own goal is missing fewer than two", full.missing.length < 2, full.missing);

const HOTEL = "ws-u-hotel-watch-a1b2";
const goal = "watch hotel prices for my Tokyo trip";
await db.insert(schema.workstreams).values({ id: HOTEL, title: "Hotel watch", goal, tools: ["web_search", "fetch_url"], roles: [{ role: "scout", brief: "Check the hotel prices and report the numbers.", tier: "super", tools: ["web_search", "fetch_url"] }, { role: "learner", brief: "Save what this run taught.", tier: "nano" }], createdAt: Date.now() });
await db.insert(schema.skills).values({ workstreamId: HOTEL, content: `## Hotel watch\n1. ${goal}\n\n## Policy\n(none yet)`, version: 1, updatedAt: Date.now() });
const ANSWER = "1. Shinjuku, Dec 12 to 15 2. A drop of 10 % or more 3. Every morning";
const h1 = await go({ workstreamId: HOTEL, title: "Hotel watch", goal, trigger: "manual", tools: ["web_search", "fetch_url"] }, ANSWER);
const cards = intakeCards(h1.questions);
const card = cards[0]?.payload.text ?? "";
const planSeq = h1.run.events.find((e) => e.type === "plan")?.seq ?? -1;
check("the vague goal gets exactly one intake card", cards.length === 1, h1.questions.map((x) => x.payload.text));
check("…with three numbered questions, options where natural, and a skip button", /\n1\. /.test(card) && /\n2\. /.test(card) && /\n3\. /.test(card) && !/\n4\. /.test(card) && card.includes("(") && cards[0]?.payload.options?.length === 1, card);
check("…asked before the plan", cards.length === 1 && planSeq > cards[0].seq, { card: cards[0]?.seq, plan: planSeq });
const mems = await db.select().from(schema.memories).where(and(eq(schema.memories.workstreamId, HOTEL), like(schema.memories.text, "Intake%")));
check("the answers are saved as three memories of the workstream", mems.length === 3 && mems.some((m) => m.text.includes("Shinjuku")) && mems.some((m) => m.text.includes("10 %")), mems.map((m) => m.text));
const hp = readFileSync(path.join(dataDir(), "prompts", `${h1.run.id}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { instance: string; user: string });
check("the plan's prompt already carries the answers", (hp.find((p) => p.instance === "orchestrator")?.user ?? "").includes("Shinjuku"));
check("the run ends done", (await runRow(h1.run.id))?.status === "done");

const h2 = await go({ workstreamId: HOTEL, title: "Hotel watch", goal, trigger: "manual", tools: ["web_search", "fetch_url"] });
check("the second run of the same workstream asks nothing", intakeCards(h2.questions).length === 0 && (await runRow(h2.run.id))?.status === "done", h2.questions.map((x) => x.payload.text));

const mb = await go({ workstreamId: brief.id, title: brief.title, goal: "run morning brief", trigger: "chat", tools: brief.tools });
check("'run morning brief' gets no intake card", intakeCards(mb.questions).length === 0 && (await runRow(mb.run.id))?.status === "done", mb.questions.map((x) => x.payload.text));
const HOTEL2 = "ws-u-hotel-watch-c3d4"; // the same vague goal, never answered, run by the scheduler
const [h] = await db.select().from(schema.workstreams).where(eq(schema.workstreams.id, HOTEL));
await db.insert(schema.workstreams).values({ ...h, id: HOTEL2, createdAt: Date.now() });
await db.insert(schema.skills).values({ workstreamId: HOTEL2, content: `## Hotel watch\n1. ${goal}\n\n## Policy\n(none yet)`, version: 1, updatedAt: Date.now() });
const cron = await go({ workstreamId: HOTEL2, title: "Hotel watch", goal, trigger: "cron", tools: ["web_search", "fetch_url"] });
check("a scheduled run of the same vague goal gets no intake card", intakeCards(cron.questions).length === 0 && (await runRow(cron.run.id))?.status === "done");

const mine = (await db.select().from(schema.runs)).filter((r) => r.startedAt >= T0);
console.log(`\n${mine.length} runs started by this check, mock cost $${mine.reduce((s, r) => s + r.costUsd, 0).toFixed(4)} (real spend: $0, NIMBUS_MODEL=mock)`);
const failed = checks.filter(([, ok]) => !ok);
console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
