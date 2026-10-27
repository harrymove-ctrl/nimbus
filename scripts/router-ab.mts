// Router checks, all in mock mode ($0): A/B cost with the router off vs on, a forced 429 → fallback, and the llm_cache.
process.env.NIMBUS_MOCK_FAST = "1";
import { buildView, fmtCost } from "../src/lib/run-view";
import { resetMockFailures } from "../src/lib/tokenfactory";
import { startRun } from "../src/runtime/source";
import type { AnyRunEvent } from "../src/lib/events";

async function once(env: Record<string, string | undefined>) {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) (saved[k] = process.env[k], v === undefined ? delete process.env[k] : (process.env[k] = v));
  resetMockFailures();
  const run = startRun({ workstreamId: "ws-checkout", title: "Checkout conversion drop on Oct 14", goal: "Why did checkout conversion drop on Oct 14?", trigger: "manual" });
  const act = (e: AnyRunEvent) => {
    if (e.type === "approval.request") run.resolveApproval(e.payload.approvalId, { decision: "approved" });
    if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[0] ?? "ok", questionId: e.payload.questionId });
  };
  for (const e of run.events) act(e);
  run.onEvent(act);
  await run.settled;
  for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  const ev = run.events;
  const v = buildView(ev);
  const end = ev.find((e) => e.type === "run.end");
  return { view: v, ev, status: end?.type === "run.end" ? end.payload.status : "?" };
}

const results: [string, boolean][] = [];
const check = (name: string, ok: boolean) => (results.push([name, ok]), console.log(`${ok ? "✓" : "✗"} ${name}`));

console.log("A/B: same demo run, router off vs on (cache off)");
const off = await once({ NIMBUS_ROUTER: "off", NIMBUS_CACHE: "off" });
const on = await once({ NIMBUS_ROUTER: "on", NIMBUS_CACHE: "off" });
const cut = 1 - on.view.costUsd / off.view.costUsd;
console.log(`  router off: ${fmtCost(off.view.costUsd)} · ${off.view.tokens.toLocaleString("en-US")} tokens`);
console.log(`  router on : ${fmtCost(on.view.costUsd)} · ${on.view.tokens.toLocaleString("en-US")} tokens · ${on.view.routedHops} hops below ceiling`);
console.log(`  saving    : ${(cut * 100).toFixed(1)}%`);
check("router on costs at least 40% less than off", cut >= 0.4);
check("event log has a route event with chosen !== ceiling", on.ev.some((e) => e.type === "route" && e.payload.chosen !== e.payload.ceiling));
check("router off pins every hop to its ceiling", off.ev.filter((e) => e.type === "route").every((e) => e.type === "route" && e.payload.chosen === e.payload.ceiling));

console.log("\nForced fallback: researcher hop 3 returns 429 twice");
const fb = await once({ NIMBUS_ROUTER: "off", NIMBUS_CACHE: "off", NIMBUS_MOCK_FAIL: "researcher:3" });
const fbEv = fb.ev.find((e) => e.type === "route" && e.payload.fallback);
console.log(`  ${fbEv && fbEv.type === "route" ? `${fbEv.payload.chosen} (ceiling ${fbEv.payload.ceiling}) · ${fbEv.payload.reason}` : "no fallback event"}`);
check("a 429 retries once, then falls one tier down, and the run completes", !!fbEv && fb.status === "done");
check("fallback never goes up", fb.ev.filter((e) => e.type === "route" && e.payload.fallback).every((e) => e.type === "route" && ["nano", "super", "ultra"].indexOf(e.payload.chosen) < ["nano", "super", "ultra"].indexOf(e.payload.ceiling)));

console.log("\nllm_cache: the same run twice with the cache on");
await once({ NIMBUS_ROUTER: "on", NIMBUS_CACHE: "on", NIMBUS_FREEZE_CONTEXT: "1" });
const c2 = await once({ NIMBUS_ROUTER: "on", NIMBUS_CACHE: "on", NIMBUS_FREEZE_CONTEXT: "1" });
const cached = c2.ev.filter((e) => e.type === "usage" && e.payload.cached).length;
console.log(`  second run: ${cached} cached hops · cost ${fmtCost(c2.view.costUsd)}`);
check("exact-match hits skip the call (usage cached: true)", cached > 0 && c2.view.costUsd < on.view.costUsd);

const pass = results.every(([, ok]) => ok);
console.log(`\nROUTER CHECKS: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
