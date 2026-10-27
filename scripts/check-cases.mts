// The six workstreams (docs/CASES.md) end to end in mock mode ($0, real subprocesses for Ship Nimbus's evals and
// typecheck): the hero twice (run two must skip the question and the approval and cost less), then the other cases.
//   pnpm check:cases [--only ship,radar,brief,audit,watch,release]
process.env.NIMBUS_DATA_DIR = "./data/check-cases"; // own database; .env.local already names ./data
process.env.NIMBUS_MODEL = "mock";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { dataDir } from "../src/db";
import type { AnyRunEvent } from "../src/lib/events";
import { buildView } from "../src/lib/run-view";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { startRun } from "../src/runtime/source";

rmSync(dataDir(), { recursive: true, force: true });
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;
const want = (k: string) => !only || only.includes(k);
const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean, detail = "") => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}${!ok && detail ? `\n    ${detail}` : ""}`));

async function go(wsId: string, o: { always?: boolean; answer?: string } = {}) {
  const w = WORKSTREAMS.find((x) => x.id === wsId)!;
  const run = startRun({ workstreamId: w.id, title: w.title, goal: w.goal, trigger: "manual", tools: w.tools });
  let pending = 0, maxPending = 0, questions = 0;
  const act = (e: AnyRunEvent) => {
    if (e.type === "question") {
      questions++;
      run.postMessage({ kind: "answer", text: o.answer ?? e.payload.options?.[0] ?? "ok", questionId: e.payload.questionId });
    }
    if (e.type === "approval.request") {
      maxPending = Math.max(maxPending, ++pending);
      // decide after a beat so concurrent requests really are pending together
      setTimeout(() => (pending--, run.resolveApproval(e.payload.approvalId, { decision: "approved", always: o.always })), 150);
    }
  };
  for (const e of run.events) act(e);
  run.onEvent(act);
  await run.settled;
  const events = run.events as AnyRunEvent[];
  return { events, view: buildView(events), questions, maxPending };
}
const results = (ev: AnyRunEvent[]) => ev.filter((e) => e.type === "tool.result").map((e) => (e.type === "tool.result" ? e : null)!);
const text = (v: unknown) => JSON.stringify(v);
const resolvedBy = (ev: AnyRunEvent[]) => ev.filter((e) => e.type === "approval.resolve").map((e) => (e.type === "approval.resolve" ? e.payload.by : ""));

if (want("ship")) {
  console.log("— Ship Nimbus, run one");
  const a = await go("ws-ship-nimbus", { always: true, answer: "Router" });
  const tr = results(a.events);
  check("run one finishes", a.view.status === "done", String(a.view.status));
  check("the Analyst's first command fails for real (wrong flag, exit 2)", tr.some((t) => t.payload.tool === "run_code" && t.payload.ok === false && /unknown flag --golden/.test(text(t.payload.output))));
  check("the retry reproduces the demo golden's failure with real eval output", tr.some((t) => t.payload.tool === "run_code" && t.payload.ok === true && /route_reason_contains/.test(text(t.payload.output)) && /FAIL/.test(text(t.payload.output))));
  check("the Analyst asked where to fix it, once", a.questions === 1);
  check("a code artifact (the patch) and a doc artifact (the PR body) exist; the body has a v2", a.view.artifacts.some((x) => x.kind === "code") && (a.view.artifacts.find((x) => x.kind === "doc")?.versions.length ?? 0) === 2);
  check("the Checker's real runs: git apply --check, eval --patch PASS, typecheck", tr.some((t) => /applies|exitCode":0/.test(text(t.payload.output)) && t.payload.tool === "run_code") && tr.some((t) => /EVAL: PASS/.test(text(t.payload.output)) && /applied cleanly/.test(text(t.payload.output))) && tr.some((t) => t.payload.tool === "run_code" && /typecheck/.test(text(t.payload.output)) && t.payload.ok));
  check("one open_pr approval, resolved by you, with the policy written: allow: open_pr for branches fix/*", resolvedBy(a.events).join() === "you" && a.view.policies.includes("allow: open_pr for branches fix/*"), `${resolvedBy(a.events)} ${a.view.policies}`);
  check("the PR was logged (mock) and has a URL", /fix\/router-fallback-ceiling/.test(readFileSync(path.join(dataDir(), "outbox.log"), "utf8")) && tr.some((t) => /github\.com\/harrymove-ctrl\/nimbus\/pull\//.test(text(t.payload.output))));
  check("the Learner wrote 5 memories", (a.view.summary?.memories.length ?? 0) === 5, String(a.view.summary?.memories.length));
  check("the real router.ts was never modified", !readFileSync("src/runtime/router.ts", "utf8").includes("ceiling stays"));

  console.log("— Ship Nimbus, run two");
  const b = await go("ws-ship-nimbus", { answer: "Router" });
  check("run two loads what run one learned (5 memories, 1 rule)", b.view.learned?.memories === 5 && b.view.learned?.policies === 1, text(b.view.learned));
  check("run two asks no question", b.questions === 0);
  check("run two's PR goes through under the rule (approval resolved by policy)", resolvedBy(b.events).join() === "policy", resolvedBy(b.events).join());
  check("run two works a different golden (429) and passes it with its patch", results(b.events).some((t) => /router-fallback-429/.test(text(t.payload.output)) && /EVAL: PASS/.test(text(t.payload.output))));
  check("run two costs less than run one", b.view.costUsd < a.view.costUsd, `${b.view.costUsd.toFixed(4)} vs ${a.view.costUsd.toFixed(4)}`);
  console.log(`  run one $${a.view.costUsd.toFixed(4)} (${a.view.tokens} tokens, ${(a.view.endedMs ?? 0) / 1000} s) · run two $${b.view.costUsd.toFixed(4)} (${b.view.tokens} tokens)`);
}
if (want("radar")) {
  console.log("— Hackathon radar");
  const r = await go("ws-radar");
  check("radar finishes; the digest is under the seeded rule (resolved by policy)", r.view.status === "done" && resolvedBy(r.events).join() === "policy", resolvedBy(r.events).join());
  check("the digest doc exists and names Bridge Bot", r.view.artifacts.some((x) => x.kind === "doc" && x.versions.some((v) => v.content.includes("Bridge Bot"))));
}
if (want("brief")) {
  console.log("— Morning brief");
  const r = await go("ws-brief");
  check("three replies wait at once (3 concurrent approvals), all approved by you", r.maxPending === 3 && resolvedBy(r.events).join() === "you,you,you", `${r.maxPending} ${resolvedBy(r.events)}`);
  check("the brief and three drafts are artifacts", r.view.artifacts.length === 4);
  check("the analyst read the real inbox files", results(r.events).some((t) => t.payload.tool === "read_repo" && /Dana/.test(text(t.payload.output))));
}
if (want("audit")) {
  console.log("— Token Factory cost audit");
  const r = await go("ws-audit");
  check("real python ranked the hops; eval:ab ran for real", results(r.events).some((t) => /top five/.test(text(t.payload.output))) && results(r.events).some((t) => /router on vs off/.test(text(t.payload.output))));
  check("writing the rules file waits for approval (write_file)", r.events.some((e) => e.type === "approval.request" && e.payload.action.kind === "write_file") && r.view.status === "done");
}
if (want("watch")) {
  console.log("— Token Factory watch");
  const r = await go("ws-watch");
  check("the catalog was fetched and the week priced by real python", results(r.events).some((t) => t.payload.tool === "fetch_url" && /Oct 29/.test(text(t.payload.output))) && results(r.events).some((t) => /week at the new prices/.test(text(t.payload.output))));
  check("a write_file approval for router-rules.json carries the expected saving and is recorded on approval", r.events.some((e) => e.type === "approval.request" && e.payload.action.kind === "write_file" && typeof (e.payload.action.details as { expectedSavingPct?: number }).expectedSavingPct === "number") && existsSync(path.join(dataDir(), "router-rules.json")));
  const ov = (await import("../src/runtime/overview")).getOverview;
  const o = await ov();
  check("the Overview shows the rule as recorded, with the saving", !!o.rules && o.rules.applied && o.rules.expectedSavingPct > 20, JSON.stringify(o.rules));
}
if (want("release")) {
  console.log("— Release watch");
  const r = await go("ws-release");
  check("the bump patch applies and the tree typechecks (real)", results(r.events).filter((t) => t.payload.tool === "run_code" && t.payload.ok).length >= 2, "");
  check("an open_pr approval for chore/bump-ai-sdk (not covered by fix/*)", r.events.some((e) => e.type === "approval.request" && e.payload.action.kind === "open_pr") && resolvedBy(r.events).join() === "you");
}

const pass = checks.every(([, ok]) => ok);
console.log(`\nCASES CHECK: ${pass ? "PASS" : "FAIL"} (${checks.filter(([, ok]) => ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
