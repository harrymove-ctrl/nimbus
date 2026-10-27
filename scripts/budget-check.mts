// Spend guards and record/replay (docs/BUDGET.md), proven in mock mode at $0.
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
import { MAX_OUT_TOKENS } from "../src/lib/models";
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
const lastT = Math.max(...capped.ev.map((e) => e.tMs));
await new Promise((r) => setTimeout(r, 1200));
check("concurrent agents stopped too (no new events after the stop)", Math.max(...capped.ev.map((e) => e.tMs)) === lastT);

console.log("\nDefault cap lets the normal demo finish, and max_tokens is passed per tier:");
process.env.NIMBUS_MOCK_LOG = "1";
mockCallLog.length = 0;
const normal = await demo();
check("the demo under the default cap finishes done", normal.view.status === "done" && !normal.view.capHit, `$${normal.view.costUsd.toFixed(3)}`);
const bad = mockCallLog.filter((c) => c.maxOutputTokens !== MAX_OUT_TOKENS[c.tier]);
check(`every model call carries its tier's max_tokens (ultra ${MAX_OUT_TOKENS.ultra}, super ${MAX_OUT_TOKENS.super}, nano ${MAX_OUT_TOKENS.nano})`, mockCallLog.length > 0 && bad.length === 0, `${mockCallLog.length} calls`);

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

const pass = checks.every(([, o]) => o);
console.log(`\nBUDGET GUARDS: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
