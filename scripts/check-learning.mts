// SPEC §16 exit test, mock mode ($0): after two runs of Checkout the learning view has the rule with its source run,
// every memory with usage counts and the latest marked; FORGET removes a memory and the next run's prompt no longer
// includes it; REVOKE removes the rule and the next run asks for approval again.
// Own database: the shared one is held open by the dev servers, and this test deletes memories and rules.
process.env.NIMBUS_DATA_DIR = "./data/check-learning"; // set here, not ??=: .env.local already names ./data
process.env.NIMBUS_CACHE = "off";
process.env.NIMBUS_MOCK_FAST = "1";
process.env.NIMBUS_DEBUG_PROMPTS = "1";
import { readFileSync } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { dataDir, getDb, schema } from "../src/db";
import { startRun } from "../src/runtime/source";
import { forgetMemory, getLearning } from "../src/runtime/learning";
import { loadSkill, revokePolicy } from "../src/runtime/skills";
import type { AnyRunEvent } from "../src/lib/events";

const db = await getDb();
const WS = "ws-checkout";
const { WORKSTREAMS } = await import("../src/lib/workstreams");
const w = WORKSTREAMS.find((x) => x.id === WS)!;
const reset = async () => {
  await db.delete(schema.memories).where(eq(schema.memories.workstreamId, WS));
  await db.delete(schema.policies).where(eq(schema.policies.workstreamId, WS));
  await db.delete(schema.skills).where(eq(schema.skills.workstreamId, WS));
  await db.insert(schema.skills).values({ workstreamId: WS, content: w.skill, version: 1, updatedAt: Date.now() });
};
await reset();

async function go(always: boolean) {
  const run = startRun({ workstreamId: WS, title: w.title, goal: w.goal, trigger: "manual" });
  const act = (e: AnyRunEvent) => {
    if (e.type === "approval.request") run.resolveApproval(e.payload.approvalId, { decision: "approved", always });
    if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[0] ?? "ok", questionId: e.payload.questionId });
  };
  for (const e of run.events) act(e);
  run.onEvent(act);
  await run.settled;
  return run;
}
const orchPrompt = (id: string) =>
  readFileSync(path.join(dataDir(), "prompts", `${id}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as { instance: string; user: string }).find((p) => p.instance === "orchestrator")!.user;

const checks: [string, boolean][] = [];
const check = (n: string, ok: boolean) => (checks.push([n, ok]), console.log(`${ok ? "✓" : "✗"} ${n}`));

const r1 = await go(true);
const after1 = await getLearning(WS);
check("after run 1: 1 rule, sourced from run 1, used 0×", after1.rules.length === 1 && after1.rules[0].runId === r1.id && after1.rules[0].usedCount === 0);
check("after run 1: skill rewrite recorded for run 1 with a diff (+ lines) and a revert point", after1.skill.runId === r1.id && after1.skill.hasPrevious && after1.skill.added > 0);
check("the skill card text excludes the ## Policy section (that is the Rules section)", !after1.skill.content.includes("## Policy") && !after1.skill.content.includes("allow:"));
check("after run 1: memories listed newest first, all from run 1, header counts match", after1.memories.length === 5 && after1.memories.every((m) => m.runId === r1.id) && after1.lastLearned?.runNumber === after1.skill.runNumber);

const r2 = await go(false);
const after2 = await getLearning(WS);
check("run 2 used the policy: rule used 1×, no approval tray", after2.rules[0].usedCount === 1 && r2.events.some((e) => e.type === "approval.resolve" && e.payload.by === "policy"));
check("run 2 put every memory in its prompt: each used 1×", after2.memories.length === 5 && after2.memories.every((m) => m.usedCount === 1));

const gone = after2.memories[0];
check("FORGET removes one memory", (await forgetMemory(WS, gone.id)) && (await getLearning(WS)).memories.length === 4 && !(await forgetMemory(WS, gone.id)));
const rule = after2.rules[0].rule;
check("REVOKE removes the rule and its line in SKILL.md", (await revokePolicy(WS, 0)) === rule && !(await loadSkill(WS)).includes(rule) && (await getLearning(WS)).rules.length === 0 && (await revokePolicy(WS, 0)) === null);
check("REVOKE leaves the Learner's rewrite and revert point alone", (await getLearning(WS)).skill.runId === r1.id || (await getLearning(WS)).skill.runId === r2.id);

const r3 = await go(false);
const p3 = orchPrompt(r3.id);
check("run 3's prompt no longer includes the forgotten memory (and still has the others)", !p3.includes(gone.text) && after2.memories.slice(1).every((m) => p3.includes(m.text)));
check("run 3's prompt has no allow: line", !p3.includes("allow: send_message"));
const resolve3 = r3.events.find((e) => e.type === "approval.resolve");
check("run 3 asked for approval again (resolved by you, not by policy)", !!resolve3 && resolve3.type === "approval.resolve" && resolve3.payload.by === "you");
const start3 = r3.events.find((e) => e.type === "run.start");
check("run 3's learned chip shows 4 memories, 0 rules", !!start3 && start3.type === "run.start" && start3.payload.learned?.memories === 4 && start3.payload.learned?.policies === 0);

// a Learner that cannot save must say so, not end in a silent "Done."
const before = (await getLearning(WS)).memories.length;
process.env.NIMBUS_TEST_LEARNER_FAIL = "1";
const r4 = await go(false);
delete process.env.NIMBUS_TEST_LEARNER_FAIL;
const failed = r4.events.find((e) => e.type === "message" && e.payload.id === "m-learn-failed");
check("a Learner that cannot save says so in the run: \"Learning failed, nothing was saved…\"", !!failed && failed.type === "message" && /Learning failed, nothing was saved/.test(failed.payload.text), failed?.type === "message" ? failed.payload.text : "no message");
check("…the run itself still finished, with no summary card", r4.events.some((e) => e.type === "run.end" && e.payload.status === "done") && !r4.events.some((e) => e.type === "message" && e.payload.card === "summary"));
check("…and nothing was saved", (await getLearning(WS)).memories.length === before);

await reset();
await db.delete(schema.skills).where(eq(schema.skills.workstreamId, WS));
await db.insert(schema.skills).values({ workstreamId: WS, content: w.skill, version: 1, updatedAt: Date.now() });
await db.delete(schema.memories).where(eq(schema.memories.workstreamId, WS));

const pass = checks.every(([, ok]) => ok);
console.log(`\nLEARNING CHECK: ${pass ? "PASS" : "FAIL"} (${checks.filter(([, ok]) => ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
