// Spend guards and record/replay (docs/BUDGET.md), proven in mock mode at $0.
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
import { LEARNER_MAX_OUT_TOKENS, MAX_OUT_TOKENS, maxOutTokens } from "../src/lib/models";
import { buildView } from "../src/lib/run-view";
import { mockCallLog } from "../src/lib/tokenfactory";
import { checkDayBudget, dayCapUsd, runCapUsd } from "../src/runtime/budget";
import { startRun } from "../src/runtime/source";
import type { AnyRunEvent } from "../src/lib/events";

const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${detail ? `  (${detail})` : ""}`));

async function demo(env: Record<string, string | undefined> = {}) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) (saved[k] = process.env[k], v === undefined ? delete process.env[k] : (process.env[k] = v));
  const run = startRun({ workstreamId: "ws-checkout", title: "Checkout conversion drop on Oct 14", goal: "Why did checkout conversion drop on Oct 14?", trigger: "manual" });
  const act = (e: AnyRunEvent) => {
    if (e.type === "approval.request") run.resolveApproval(e.payload.approvalId, { decision: "approved" });
    if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[e.payload.options.length - 1] ?? "ok", questionId: e.payload.questionId });
  };
  for (const e of run.events) act(e);
  run.onEvent(act);
  await run.settled;
  for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  return { ev: run.events, view: buildView(run.events) };
}

console.log("defaults: run cap $" + runCapUsd() + ", day cap $" + dayCapUsd());
check("defaults are $0.25 per run and $5 per day", runCapUsd() === 0.25 && dayCapUsd() === 5);

console.log("\nRun cap 0.01 (mock):");
const capped = await demo({ NIMBUS_RUN_CAP_USD: "0.01" });
const err = capped.ev.find((e) => e.type === "run.error");
const end = capped.ev.find((e) => e.type === "run.end");
console.log(`  cost at stop $${capped.view.costUsd.toFixed(4)} · ${capped.ev.length} events`);
check('the run stops with run.error "spend cap"', !!err && err.type === "run.error" && err.payload.message === "spend cap" && err.payload.kind === "spend_cap");
check('run.end is "failed" and the header would show the "Cap hit" pill (view.capHit)', !!end && end.type === "run.end" && end.payload.status === "failed" && capped.view.capHit);
check("it stopped early: no learner, no message sent, spend within one hop of the cap", !capped.view.lanes.some((l) => l.role === "learner") && !capped.ev.some((e) => e.type === "tool.result" && e.payload.tool === "request_approval" && (e.payload.output as { logged?: boolean })?.logged) && capped.view.costUsd < 0.03);
await new Promise((r) => setTimeout(r, 1200));
const endSeq = capped.ev.findIndex((e) => e.type === "run.end");
const afterStop = capped.ev.slice(endSeq + 1).filter((e) => e.type === "route" || e.type === "tool.call" || e.type === "artifact.version" || e.type === "approval.request");
check("concurrent agents stopped too: no new hop, tool call, artifact or approval starts after the stop", endSeq > 0 && afterStop.length === 0, `${capped.ev.length - endSeq - 1} closing events after run.end, none of them new work`);

console.log("\nDefault cap lets the normal demo finish, and max_tokens is passed per tier:");
process.env.NIMBUS_MOCK_LOG = "1";
mockCallLog.length = 0;
const normal = await demo();
check("the demo under the default cap finishes done", normal.view.status === "done" && !normal.view.capHit, `$${normal.view.costUsd.toFixed(3)}`);
const bad = mockCallLog.filter((c) => c.maxOutputTokens !== maxOutTokens(c.tier, c.role));
check(`every model call carries its tier's max_tokens (ultra ${MAX_OUT_TOKENS.ultra}, super ${MAX_OUT_TOKENS.super}, nano ${MAX_OUT_TOKENS.nano}; the Learner ${LEARNER_MAX_OUT_TOKENS})`, mockCallLog.length > 0 && bad.length === 0, `${mockCallLog.length} calls`);

console.log("\nDay cap:");
const before = await checkDayBudget();
check("mock runs do not count toward the day cap (the free demo is never refused)", before.ok && before.spentUsd === 0, `today $${before.spentUsd.toFixed(3)} counted`);
process.env.NIMBUS_COUNT_MOCK = "1"; // for this test only: count mock spend so the guard can be exercised at $0
const counted = await checkDayBudget();
check("with NIMBUS_COUNT_MOCK=1 the same runs are counted", counted.spentUsd > 0, `today $${counted.spentUsd.toFixed(3)}`);
process.env.NIMBUS_DAY_CAP_USD = String(counted.spentUsd + 1);
check("under the day cap, runs start", (await checkDayBudget()).ok);
process.env.NIMBUS_DAY_CAP_USD = String(Math.max(0.0001, counted.spentUsd / 2));
const refused = await checkDayBudget();
check("past the day cap, new runs are refused with a clear message", !refused.ok && /Daily spend cap reached/.test(refused.message ?? ""), refused.message ?? "");
delete process.env.NIMBUS_DAY_CAP_USD;
delete process.env.NIMBUS_COUNT_MOCK;

console.log("\nRecord a run, replay it, compare:");
const { mkdtempSync, readdirSync, readFileSync } = await import("node:fs");
const os = await import("node:os");
const path = await import("node:path");
const dir = mkdtempSync(path.join(os.tmpdir(), "nimbus-rec-"));
const live = await demo({ NIMBUS_RECORD_REAL: "1", NIMBUS_RECORD_DIR: dir });
await new Promise((r) => setTimeout(r, 300));
const files = readdirSync(dir).filter((f) => f.endsWith(".events.json"));
check("NIMBUS_RECORD_REAL=1 wrote one fixtures-format file for the run", files.length === 1, files[0] ?? "none");
const recorded = JSON.parse(readFileSync(path.join(dir, files[0]), "utf8")) as { type: string; gate?: string; tMs: number }[];
check("the recording marks the question and the approval as gates and drops the person's own events", recorded.filter((e) => e.gate).length === 2 && !recorded.some((e) => e.type === "policy") && !recorded.some((e) => e.type === "approval.resolve"), `${recorded.length} events, gates: ${recorded.filter((e) => e.gate).map((e) => e.gate).join("+")}`);
check("its times are monotonic", recorded.every((e, i) => i === 0 || e.tMs >= recorded[i - 1].tMs));

const replayed = await demo({ NIMBUS_REPLAY: path.join(dir, files[0]) });
const norm = (v: ReturnType<typeof buildView>) => ({
  status: v.status,
  lanes: v.lanes.map((l) => `${l.instance}:${l.role}`).join(","),
  transcript: v.transcript.map((t) => (t.t === "agent" ? `agent:${t.instance}:${t.text}` : t.t === "user" ? `user:${t.text}` : t.t === "artifact" ? `artifact:${t.title}:v${t.version}` : t.t === "approval" ? `approval:${t.action.summary}:${t.status}` : t.t === "question" ? `question:${t.text}:${t.answer}` : t.t === "summary" ? `summary:${t.summary.memories.join("|")}` : t.t === "plan" ? `plan:${t.agents.map((a) => a.role).join(",")}` : t.t === "handoff" ? `handoff:${t.from}>${t.to}` : t.t)),
  artifacts: v.artifacts.map((a) => `${a.id}:${a.versions.map((x) => x.content.length).join(",")}`).join(";"),
  tokens: v.tokens,
  cost: v.costUsd.toFixed(6),
  baseline: v.baselineUsd.toFixed(6),
  routedHops: v.routedHops,
  segments: v.lanes.map((l) => l.segments.length).join(","),
  toolCalls: v.toolCalls.length,
});
const a = norm(live.view), b = norm(replayed.view);
const diffs = (Object.keys(a) as (keyof typeof a)[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
check("the replayed run is identical to the recorded one (status, lanes, transcript, artifacts, tokens, cost, routing, segments, tool calls)", diffs.length === 0, diffs.length ? `differs: ${diffs.join(", ")}` : `${a.tokens} tokens · $${a.cost} · ${a.transcript.length} transcript items`);
if (diffs.length) for (const k of diffs) console.log(`    ${k}:\n      live    ${JSON.stringify(a[k]).slice(0, 220)}\n      replay  ${JSON.stringify(b[k]).slice(0, 220)}`);

const pass = checks.every(([, o]) => o);
console.log(`\nBUDGET GUARDS: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
