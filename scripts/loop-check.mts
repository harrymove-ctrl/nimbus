// Phase 3 exit test, mock mode ($0): run the same workstream twice. Run 2's orchestrator prompt must contain
// run 1's memories and its SKILL.md (including the policy line from "Approve & always allow"), and the policy
// must be honored (no approval tray on run 2). Also checks the diff in the run summary.
process.env.NIMBUS_CACHE = "off";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { dataDir, getDb, schema } from "../src/db";
import { startRun } from "../src/runtime/source";
import { loadSkill, revertSkill } from "../src/runtime/skills";
import type { AnyRunEvent } from "../src/lib/events";

const db = await getDb();
// start from a clean slate for this workstream so the check is repeatable
await db.delete(schema.memories).where(eq(schema.memories.workstreamId, "ws-checkout"));
await db.delete(schema.skills).where(eq(schema.skills.workstreamId, "ws-checkout"));
const { WORKSTREAMS } = await import("../src/lib/workstreams");
const w = WORKSTREAMS.find((x) => x.id === "ws-checkout")!;
await db.insert(schema.skills).values({ workstreamId: w.id, content: w.skill, version: 1, updatedAt: Date.now() });

async function go(label: string, decision: "approve_always" | "approve") {
  const run = startRun({ workstreamId: w.id, title: w.title, goal: w.goal, trigger: "manual" });
  const act = (e: AnyRunEvent) => {
    if (e.type === "approval.request") run.resolveApproval(e.payload.approvalId, { decision: "approved", always: decision === "approve_always" });
    if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[0] ?? "ok", questionId: e.payload.questionId });
  };
  for (const e of run.events) act(e);
  run.onEvent(act);
  await run.settled;
  console.log(`${label}: ${run.id} · ${run.events.length} events`);
  return run;
}

const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean) => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}`));

const r1 = await go("run 1", "approve_always");
const r2 = await go("run 2", "approve");

const prompts = readFileSync(path.join(dataDir(), "prompts", `${r2.id}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { instance: string; user: string });
const orch = prompts.find((p) => p.instance === "orchestrator")!;
const p1 = readFileSync(path.join(dataDir(), "prompts", `${r1.id}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { instance: string; user: string }).find((p) => p.instance === "orchestrator")!;

check("run 1's orchestrator prompt had no memories yet", !p1.user.includes("Memories from earlier runs"));
check("run 2's orchestrator prompt contains run 1's memories", orch.user.includes("Memories from earlier runs") && orch.user.includes("iOS Safari completion is the first segment"));
check("run 2's orchestrator prompt contains the SKILL.md written by run 1", orch.user.includes("Check the status page for incidents inside the drop window"));
check("…including the policy line from Approve & always allow", orch.user.includes("allow: send_message to #growth for this workstream"));
const stamp = r2.events.find((e) => e.type === "approval.resolve");
check("run 2 honored the policy (approval resolved by policy, no tray)", !!stamp && stamp.type === "approval.resolve" && stamp.payload.by === "policy");
const sum1 = r1.events.find((e) => e.type === "message" && e.payload.card === "summary");
check("run 1's summary has memories and a SKILL.md diff with an added line", !!sum1 && sum1.type === "message" && (sum1.payload.summary?.memories.length ?? 0) >= 5 && !!sum1.payload.summary?.skillDiff.some((d) => d.op === "+"));
const mems = await db.select().from(schema.memories).where(eq(schema.memories.workstreamId, "ws-checkout"));
check("memories are stored once (no duplicates after two runs)", mems.length === 5);

// Revert, tested with two known saves (in mock mode the Learner's rewrite on run 2 is identical to run 1's).
const { saveSkill } = await import("../src/runtime/skills");
await saveSkill("ws-checkout", "## A");
await saveSkill("ws-checkout", "## B");
const restored = await revertSkill("ws-checkout");
check("Revert skill change restores the SKILL.md from before the latest rewrite", restored === "## A" && (await loadSkill("ws-checkout")) === "## A");
check("a second revert has nothing to undo", (await revertSkill("ws-checkout")) === null);

// leave the workstream as freshly seeded (no test residue in the Memory tab)
await db.delete(schema.memories).where(eq(schema.memories.workstreamId, "ws-checkout"));
await db.update(schema.skills).set({ content: w.skill, previous: null }).where(eq(schema.skills.workstreamId, "ws-checkout"));

const pass = checks.every(([, ok]) => ok);
console.log(`\nLOOP CHECK: ${pass ? "PASS" : "FAIL"}`);
process.exit(pass ? 0 : 1);
