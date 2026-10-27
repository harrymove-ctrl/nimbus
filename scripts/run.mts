// Headless run: `pnpm demo` (Phase 1 exit test). Prints the event stream as text; --yes answers questions and approves.
import { createInterface } from "node:readline/promises";
import { fmtCost } from "../src/lib/run-view";
import { buildView } from "../src/lib/run-view";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { modelMode } from "../src/lib/tokenfactory";
import { startRun } from "../src/runtime/source";
import type { AnyRunEvent } from "../src/lib/events";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const positional = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] ?? "").startsWith("--") );

const wsId = opt("workstream") ?? "ws-checkout";
const ws = WORKSTREAMS.find((w) => w.id === wsId);
if (!ws) {
  console.error(`unknown workstream ${wsId}; known: ${WORKSTREAMS.map((w) => w.id).join(", ")}`);
  process.exit(2);
}
if (opt("router")) process.env.NIMBUS_ROUTER = opt("router")!;
if (opt("cache")) process.env.NIMBUS_CACHE = opt("cache")!;
if (opt("record")) console.log(`(--record ${opt("record")}: stubbed until Phase 3b; the run will print normally and no golden is written)`);

const goal = positional.join(" ").trim() || ws.goal;
const yes = flag("yes");
const verbose = flag("verbose");
console.log(`Nimbus run · ${ws.title}\n  goal: ${goal}\n  model: ${modelMode()} · router: ${process.env.NIMBUS_ROUTER ?? "on"}${yes ? " · --yes (auto-answer, auto-approve)" : ""}\n`);

const rl = yes ? null : createInterface({ input: process.stdin, output: process.stdout });
const run = startRun({ workstreamId: ws.id, title: ws.title, goal, mode: (opt("mode") as "ask" | "auto-low" | "dry") ?? "ask", tier: (opt("tier") as "auto" | "cheap" | "max") ?? "auto", trigger: "manual" });

const short = (v: unknown, n = 90) => String(typeof v === "string" ? v : JSON.stringify(v)).replace(/\s+/g, " ").slice(0, n);
const t = (e: AnyRunEvent) => `[${(e.tMs / 1000).toFixed(1).padStart(5)}s] ${e.agentInstance.padEnd(13)}`;

async function handle(e: AnyRunEvent) {
  switch (e.type) {
    case "plan":
      console.log(`${t(e)} plan: ${e.payload.agents.map((a) => `${a.role}(${a.tier})`).join(", ")} · tools ${e.payload.tools.join(",")} · ${e.payload.estimate.label}`);
      break;
    case "agent.spawn": console.log(`${t(e)} spawn ← ${e.payload.by}`); break;
    case "agent.start": console.log(`${t(e)} start`); break;
    case "agent.end": console.log(`${t(e)} end${e.payload.summary ? `: ${short(e.payload.summary, 70)}` : ""}`); break;
    case "agent.error": console.log(`${t(e)} ERROR ${e.payload.message}`); break;
    case "route":
      if (verbose || e.payload.chosen !== e.payload.ceiling || e.payload.fallback) console.log(`${t(e)} route hop ${e.payload.hop}: ${e.payload.chosen} (ceiling ${e.payload.ceiling})${e.payload.fallback ? " FALLBACK" : ""} · ${e.payload.reason}`);
      break;
    case "tool.call": console.log(`${t(e)} tool ${e.payload.tool} ${short(e.payload.input, 70)}`); break;
    case "tool.result": console.log(`${t(e)} ${e.payload.ok ? "ok " : "FAIL"} ${e.payload.tool} → ${short(e.payload.output, 80)}`); break;
    case "message": if (!e.payload.card) console.log(`${t(e)} ${e.payload.role === "user" ? "person:" : "says:"} ${short(e.payload.text, 110)}`); break;
    case "handoff": console.log(`${t(e)} handoff → ${e.payload.to}`); break;
    case "artifact.version": console.log(`${t(e)} artifact ${e.payload.kind} "${short(e.payload.title, 50)}" v${e.payload.version}`); break;
    case "policy": console.log(`${t(e)} policy: ${e.payload.rule}`); break;
    case "run.end": console.log(`${t(e)} RUN ${e.payload.status.toUpperCase()}`); break;
    case "run.error": console.log(`${t(e)} RUN ERROR ${e.payload.message}`); break;
    case "question": {
      console.log(`${t(e)} ? ${e.payload.text}  [${(e.payload.options ?? []).join(" | ")}]`);
      let ans = e.payload.options?.[e.payload.options.length - 1] ?? "continue";
      if (!yes) {
        const a = (await rl!.question(`  answer (enter = "${ans}"): `)).trim();
        if (a) ans = a;
      }
      console.log(`${t(e)} person: ${ans}`);
      run.postMessage({ kind: "answer", text: ans, questionId: e.payload.questionId });
      break;
    }
    case "approval.request": {
      console.log(`${t(e)} APPROVAL (${e.payload.action.risk}): ${e.payload.action.summary}`);
      let ok = true;
      if (!yes) ok = /^y/i.test((await rl!.question("  approve? [y/N] ")).trim());
      console.log(`${t(e)} ${ok ? "approved" : "rejected"}${yes ? " (--yes)" : ""}`);
      run.resolveApproval(e.payload.approvalId, { decision: ok ? "approved" : "rejected" });
      break;
    }
    case "approval.resolve": if (e.payload.by !== "you") console.log(`${t(e)} approval ${e.payload.decision} by ${e.payload.by}`); break;
  }
}
for (const e of run.events) void handle(e);
run.onEvent((e) => void handle(e));
await run.settled;
rl?.close();

// ---- summary and the Phase 1 exit test ----
const ev = run.events;
const view = buildView(ev);
const spans = ev.filter((e) => e.type === "agent.start" && !["orchestrator", "learner-1"].includes(e.agentInstance)).map((s) => ({ s: s.tMs, e: ev.find((x) => x.type === "agent.end" && x.agentInstance === s.agentInstance)?.tMs ?? s.tMs }));
let maxConcurrent = 0;
for (const a of spans) maxConcurrent = Math.max(maxConcurrent, spans.filter((b) => b.s < a.e && b.e > a.s).length);
const runEnd = ev.find((e) => e.type === "run.end");
const lastT = Math.max(...ev.map((e) => e.tMs));
const docs = ev.filter((e) => e.type === "artifact.version" && e.payload.kind === "doc");
const approvals = ev.filter((e) => e.type === "approval.request").length;
const routes = ev.filter((e) => e.type === "route");
const routedDown = routes.filter((e) => e.type === "route" && (e.payload.chosen !== e.payload.ceiling || e.payload.fallback)).length;
const cached = ev.filter((e) => e.type === "usage" && e.payload.cached).length;

console.log(`
── summary ─────────────────────────────────────────────
status        ${runEnd && runEnd.type === "run.end" ? runEnd.payload.status : "?"}
duration      ${(lastT / 1000).toFixed(1)}s (run.end at ${((runEnd?.tMs ?? 0) / 1000).toFixed(1)}s, learner after)
tokens        ${view.tokens.toLocaleString("en-US")}
cost          ${fmtCost(view.costUsd)}  (baseline at ceilings ${fmtCost(view.baselineUsd)}${view.savings !== null ? `, ${Math.round(view.savings * 100)}% saved` : ""})
agents        ${view.lanes.length} lanes, max ${maxConcurrent} sub-agents running at once
routing       ${routes.length} hops, ${routedDown} below ceiling or fallback · ${cached} cached
artifacts     ${docs.length} doc version(s)
approvals     ${approvals}`);

const checks: [string, boolean][] = [
  ["spawned ≥ 3 agents concurrently", maxConcurrent >= 3],
  ["produced a doc artifact", docs.length >= 1],
  ["requested ≥ 1 approval", approvals >= 1],
  ["finished under 60 s", lastT < 60_000],
  ["printed usage and cost", view.tokens > 0],
  ["run status done", runEnd?.type === "run.end" && runEnd.payload.status === "done"],
];
for (const [n, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${n}`);
const pass = checks.every(([, ok]) => ok);
console.log(`\nEXIT TEST: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
