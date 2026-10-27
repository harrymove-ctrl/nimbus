// Trajectory evals (SPEC §13): replay goldens against the runtime, grade every hop, print golden × hop, write evals/report.json.
//   pnpm eval [--cheap] [--router on|off] [--only a,b] [--ab] [--verbose] [--patch file.patch]
//   --only also finds the demo goldens in evals/demo (deliberately failing; never part of the suite).
//   --patch applies a unified diff to a scratch copy of the repo first, then runs there (how the crew's Checker verifies a fix).
// Mock model by default (no keys). Exit 1 if the pass rate is under 90 % or any `final` assertion fails.
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_CACHE = "off";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../src/db";
import type { AnyRunEvent } from "../src/lib/events";
import { modelMode } from "../src/lib/tokenfactory";
import { buildView } from "../src/lib/run-view";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { startRun } from "../src/runtime/source";
import { check, type Result } from "../evals/assertions";
import type { Golden, Scenario } from "../evals/types";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const KNOWN = ["cheap", "router", "only", "ab", "verbose", "patch"];
const unknown = argv.filter((a) => a.startsWith("--") && !KNOWN.includes(a.slice(2)));
if (unknown.length) {
  const ALIAS: Record<string, string> = { golden: "only", goldens: "only", test: "only", name: "only", filter: "only", single: "only", diff: "patch", file: "patch", fast: "cheap" };
  const near = (a: string) => ALIAS[a.slice(2)] ?? KNOWN.find((k) => k.startsWith(a.slice(2, 5)) || a.slice(2).startsWith(k));
  console.error(`unknown flag ${unknown[0]}${near(unknown[0]) ? `; did you mean --${near(unknown[0])}?` : ""}\nusage: pnpm eval [--cheap] [--router on|off] [--only a,b] [--ab] [--verbose] [--patch file.patch]`);
  process.exit(2);
}

// --patch: run the same command inside a scratch copy of the repo with the diff applied (nothing in the real tree changes).
const patchFile = opt("patch");
if (patchFile && !process.env.NIMBUS_EVAL_OVERLAY) {
  if (!existsSync(patchFile)) (console.error(`patch file not found: ${patchFile}`), process.exit(2));
  const overlay = mkdtempSync(path.join(os.tmpdir(), "nimbus-overlay-"));
  for (const d of ["src", "evals", "fixtures", "scripts"]) cpSync(path.join(process.cwd(), d), path.join(overlay, d), { recursive: true, filter: (f) => !f.includes(`${path.sep}real-runs`) });
  for (const f of ["package.json", "tsconfig.json"]) cpSync(path.join(process.cwd(), f), path.join(overlay, f));
  symlinkSync(path.join(process.cwd(), "node_modules"), path.join(overlay, "node_modules"));
  const ap = spawnSync("git", ["apply", "--whitespace=nowarn", path.resolve(patchFile)], { cwd: overlay, encoding: "utf8" });
  if (ap.status !== 0) (console.error(`patch does not apply:\n${ap.stderr}`), rmSync(overlay, { recursive: true, force: true }), process.exit(1));
  console.log(`patch ${path.basename(patchFile)} applied cleanly to a scratch copy`);
  const rest = argv.filter((a, i) => a !== "--patch" && argv[i - 1] !== "--patch");
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/eval.mts", ...rest], { cwd: overlay, stdio: "inherit", env: { ...process.env, NIMBUS_EVAL_OVERLAY: "1" } });
  rmSync(overlay, { recursive: true, force: true }); // the symlinked node_modules is removed as a link, not followed
  process.exit(r.status ?? 1);
}

const cheap = flag("cheap");
const only = opt("only")?.split(",");
const verbose = flag("verbose");

const dir = path.join(process.cwd(), "evals", "trajectories");
const load = (d: string) => (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(readFileSync(path.join(d, f), "utf8")) as Golden) : []);
let goldens = load(dir);
if (only) goldens = [...goldens, ...load(path.join(process.cwd(), "evals", "demo"))].filter((g) => only.includes(g.name));
if (cheap) goldens = goldens.filter((g) => g.cheap); // the CI set: a few goldens, Nano judge
if (!goldens.length) {
  console.error("no goldens matched");
  process.exit(2);
}

async function resetWorkstream(id: string) {
  const db = await getDb();
  const w = WORKSTREAMS.find((x) => x.id === id)!;
  await db.delete(schema.memories).where(eq(schema.memories.workstreamId, id));
  await db.delete(schema.policies).where(eq(schema.policies.workstreamId, id));
  for (const line of w.skill.split("## Policy")[1]?.split("\n").map((l) => l.trim()).filter((l) => l.startsWith("allow:")) ?? []) await db.insert(schema.policies).values({ workstreamId: id, rule: line, sourceRunId: null, createdAt: Date.now() }).onConflictDoNothing();
  await db.update(schema.skills).set({ content: w.skill, previous: null }).where(eq(schema.skills.workstreamId, id));
}

async function runScenario(g: Golden, s: Scenario): Promise<AnyRunEvent[]> {
  const ws = WORKSTREAMS.find((w) => w.id === g.workstream)!;
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(s.env ?? {})) (saved[k] = process.env[k], (process.env[k] = v));
  let qi = 0, ai = 0, steered = false;
  const run = startRun({ workstreamId: ws.id, title: ws.title, goal: s.goal ?? ws.goal, mode: s.mode, tier: s.tier, trigger: "manual" });
  const act = (e: AnyRunEvent) => {
    if (e.type === "plan" && s.steer && !steered) (steered = true, run.postMessage({ kind: "steer", text: s.steer }));
    if (e.type === "question") run.postMessage({ kind: "answer", text: s.answers?.[qi++] ?? e.payload.options?.[e.payload.options.length - 1] ?? "ok", questionId: e.payload.questionId });
    if (e.type === "approval.request") {
      const d = s.approvals?.[ai++] ?? "approve";
      run.resolveApproval(e.payload.approvalId, { decision: d === "reject" ? "rejected" : "approved", always: d === "approve_always", note: d === "reject" ? (s.note ?? "No.") : undefined });
    }
  };
  for (const e of run.events) act(e);
  run.onEvent(act);
  if (s.cancel_after_ms) setTimeout(() => run.stop("cancel"), s.cancel_after_ms);
  await run.settled;
  for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
  return run.events;
}

type GoldenResult = { name: string; workstream: string; pass: boolean; hops: { agent: string; passed: number; total: number; fails: Result[] }[]; final: { passed: number; total: number; fails: Result[] }; costUsd: number; seconds: number };

async function evaluate(router: "on" | "off"): Promise<GoldenResult[]> {
  process.env.NIMBUS_ROUTER = router;
  const out: GoldenResult[] = [];
  for (const g of router === "off" ? goldens.filter((x) => !x.requires_router) : goldens) {
    await resetWorkstream(g.workstream);
    let events: AnyRunEvent[] = [];
    let s: Scenario | undefined = g.input;
    while (s) {
      events = await runScenario(g, s); // assertions apply to the last run of a `then` chain
      s = s.then;
    }
    const view = buildView(events);
    const hops = [];
    for (const h of g.hops) {
      const rs = await Promise.all(h.expect.map((a) => check(a, events, h.agent)));
      hops.push({ agent: h.agent, passed: rs.filter((r) => r.ok).length, total: rs.length, fails: rs.filter((r) => !r.ok) });
    }
    const fr = await Promise.all(g.final.map((a) => check(a, events)));
    const res: GoldenResult = { name: g.name, workstream: g.workstream, pass: hops.every((h) => h.fails.length === 0) && fr.every((r) => r.ok), hops, final: { passed: fr.filter((r) => r.ok).length, total: fr.length, fails: fr.filter((r) => !r.ok) }, costUsd: view.costUsd, seconds: Math.max(...events.map((e) => e.tMs)) / 1000 };
    out.push(res);
  }
  return out;
}

function print(results: GoldenResult[], router: string) {
  console.log(`\nmodel ${modelMode()} · router ${router} · ${results.length} golden(s)${cheap ? " (--cheap set)" : ""}`);
  console.log(`${"golden".padEnd(26)} ${"hops (passed/asserted)".padEnd(58)} ${"final".padEnd(6)} ${"cost".padEnd(8)} ${"sec".padEnd(5)} result`);
  for (const r of results) {
    const hops = r.hops.filter((h) => h.total).map((h) => `${h.agent.slice(0, 5)} ${h.passed}/${h.total}`).join(" · ");
    console.log(`${r.name.padEnd(26)} ${hops.padEnd(58)} ${`${r.final.passed}/${r.final.total}`.padEnd(6)} ${`$${r.costUsd.toFixed(3)}`.padEnd(8)} ${r.seconds.toFixed(1).padEnd(5)} ${r.pass ? "PASS" : "FAIL"}`);
    for (const h of r.hops) for (const f of h.fails) console.log(`    ✗ ${h.agent}: ${f.assertion}  (${f.detail})`);
    for (const f of r.final.fails) console.log(`    ✗ final: ${f.assertion}  (${f.detail})`);
  }
}

function totals(results: GoldenResult[]) {
  const total = results.reduce((n, r) => n + r.final.total + r.hops.reduce((m, h) => m + h.total, 0), 0);
  const passed = results.reduce((n, r) => n + r.final.passed + r.hops.reduce((m, h) => m + h.passed, 0), 0);
  return { assertions: total, passed, passRate: total ? passed / total : 1, costUsd: results.reduce((n, r) => n + r.costUsd, 0), finalFailures: results.reduce((n, r) => n + r.final.fails.length, 0), goldensPassed: results.filter((r) => r.pass).length, goldens: results.length };
}

const routers: ("on" | "off")[] = flag("ab") ? ["off", "on"] : [(opt("router") as "on" | "off") ?? "on"];
const runs: Record<string, { results: GoldenResult[]; totals: ReturnType<typeof totals> }> = {};
for (const r of routers) {
  const results = await evaluate(r);
  print(results, r);
  const t = totals(results);
  runs[r] = { results, totals: t };
  console.log(`  assertions ${t.passed}/${t.assertions} (${(t.passRate * 100).toFixed(1)}%) · goldens ${t.goldensPassed}/${t.goldens} · spend $${t.costUsd.toFixed(3)} · final failures ${t.finalFailures}`);
}

let delta: { spendDeltaPct: number; passRateDeltaPp: number } | undefined;
if (runs.off && runs.on) {
  // compare on the goldens both settings ran (router-only goldens are skipped when off)
  const common = new Set(runs.off.results.map((r) => r.name));
  const onSame = runs.on.results.filter((r) => common.has(r.name));
  const spendOn = onSame.reduce((n, r) => n + r.costUsd, 0);
  delta = { spendDeltaPct: (1 - spendOn / runs.off.totals.costUsd) * 100, passRateDeltaPp: (totals(onSame).passRate - runs.off.totals.passRate) * 100 };
  console.log(`\ncompared on ${common.size} common golden(s): off $${runs.off.totals.costUsd.toFixed(3)} · on $${spendOn.toFixed(3)}`);
  console.log(`\nrouter on vs off: spend ${delta.spendDeltaPct >= 0 ? "−" : "+"}${Math.abs(delta.spendDeltaPct).toFixed(1)}% · pass rate ${delta.passRateDeltaPp >= 0 ? "+" : ""}${delta.passRateDeltaPp.toFixed(1)} pp`);
  if (modelMode() === "mock") console.log("  (mock mode: scripted outputs do not depend on the tier, so the pass-rate delta cannot show a quality drop; measure it with NIMBUS_MODEL=nebius)");
}

const main = runs[routers[routers.length - 1]];
// a partial run (--only) must not overwrite the full-suite report
if (!only && !process.env.NIMBUS_EVAL_NO_REPORT) writeFileSync(path.join(process.cwd(), "evals", "report.json"), JSON.stringify({ model: modelMode(), cheap, routers, delta, runs, ...main.totals }, null, 2));
if (verbose && !only) console.log("wrote evals/report.json");
const fail = main.totals.passRate < 0.9 || main.totals.finalFailures > 0;
console.log(`\nEVAL: ${fail ? "FAIL" : "PASS"} (pass rate ${(main.totals.passRate * 100).toFixed(1)}%, final failures ${main.totals.finalFailures}; gate: ≥ 90% and no failed final)`);
process.exit(fail ? 1 : 0);
