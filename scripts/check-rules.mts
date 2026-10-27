// An approved router rule (data/router-rules.json) changes routing for real, mock mode ($0): the same Ship Nimbus run costs less
// with "the Analyst's third hop and later run on Nano", the route events say why, the first two hops are untouched, "Max" and
// NIMBUS_RULES=off ignore it, and a rule the router cannot check is ignored instead of guessed at.
process.env.NIMBUS_DATA_DIR = "./data/check-rules"; // set here, not ??=: .env.local already names ./data
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_FREEZE_CONTEXT = "1"; // no memories in prompts: every run plays the same script, so costs compare
import { rmSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../src/db";
import type { AnyRunEvent } from "../src/lib/events";
import { buildView } from "../src/lib/run-view";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { startRun } from "../src/runtime/source";

rmSync(dataDir(), { recursive: true, force: true });
mkdirSync(dataDir(), { recursive: true });
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail}` : ""}`));
const w = WORKSTREAMS.find((x) => x.id === "ws-ship-nimbus")!; // its Orchestrator has hops that need Ultra (the PR approval), so a cap changes routing
const rules = (r: unknown) => writeFileSync(path.join(dataDir(), "router-rules.json"), JSON.stringify({ rules: r }));

async function go(tier?: "max") {
  const run = startRun({ workstreamId: w.id, title: w.title, goal: w.goal, trigger: "manual", tier });
  const act = (e: AnyRunEvent) => {
    if (e.type === "approval.request") run.resolveApproval(e.payload.approvalId, { decision: "approved" });
    if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[0] ?? "ok", questionId: e.payload.questionId });
  };
  for (const e of run.events) act(e);
  run.onEvent(act);
  await run.settled;
  const ev = run.events as AnyRunEvent[];
  const orch = ev.filter((e) => e.type === "route" && e.agent === "analyst").map((e) => (e.type === "route" ? e.payload : null)!);
  return { cost: buildView(ev).costUsd, orch };
}

const base = await go();
check("without a rules file the Analyst keeps the tiers the classifier gives it", !base.orch.some((r) => r.reason.includes("router-rules")) && base.orch.some((r, i) => i >= 2 && r.chosen === "super"), JSON.stringify(base.orch.map((r) => r.chosen)));

rules([{ role: "analyst", afterTurn: 2, maxTier: "nano", note: "the Analyst's third hop on runs on Nano" }]);
const withRule = await go();
const capped = withRule.orch.filter((r) => r.reason.includes("router-rules.json"));
check("with the rule the Analyst's first two hops are untouched", !withRule.orch[0].reason.includes("router-rules") && !withRule.orch[1].reason.includes("router-rules") && withRule.orch[0].chosen === base.orch[0].chosen && withRule.orch[1].chosen === base.orch[1].chosen);
check("…and every later hop that would have run above Nano is capped at Nano, with the reason in the route event", capped.length >= 1 && withRule.orch.slice(2).every((r) => r.chosen === "nano"), JSON.stringify(withRule.orch.map((r) => [r.chosen, r.reason])));
check("the same run costs less with the rule", withRule.cost < base.cost, `${withRule.cost.toFixed(5)} vs ${base.cost.toFixed(5)}`);
console.log(`  run without the rule $${base.cost.toFixed(4)} · with it $${withRule.cost.toFixed(4)} (−${((1 - withRule.cost / base.cost) * 100).toFixed(1)} %)`);

process.env.NIMBUS_RULES = "off";
const off = await go();
check("NIMBUS_RULES=off ignores the file", !off.orch.some((r) => r.reason.includes("router-rules")) && Math.abs(off.cost - base.cost) / base.cost < 0.02);
delete process.env.NIMBUS_RULES;

const max = await go("max");
check("Tier = Max is the person's override: the rule does not apply", !max.orch.some((r) => r.reason.includes("router-rules")));

rules([{ role: "analyst", turnLabel: "Reporting", maxTier: "nano" }, { role: "researcher", noToolCall: true, maxTier: "nano" }]);
const unsupported = await go();
check("rules the router cannot check (turnLabel, noToolCall) are ignored, not guessed at", !unsupported.orch.some((r) => r.reason.includes("router-rules")) && Math.abs(unsupported.cost - base.cost) / base.cost < 0.02);

const pass = checks.every(([, ok]) => ok);
console.log(`\nRULES CHECK: ${pass ? "PASS" : "FAIL"} (${checks.filter(([, ok]) => ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
