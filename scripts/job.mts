// Headless entrypoint (Nebius Serverless Job): `pnpm run:job --workstream <id> --yes`.
// --yes approves low-risk actions only; anything riskier is rejected with a note, because a job has no person to ask.
import { startRun } from "../src/runtime/source";
import { WORKSTREAMS } from "../src/lib/workstreams";
import { buildView, fmtCost } from "../src/lib/run-view";

const argv = process.argv.slice(2);
const opt = (n: string) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined);
const ws = WORKSTREAMS.find((w) => w.id === opt("workstream"));
if (!ws) {
  console.error(`usage: pnpm run:job --workstream <${WORKSTREAMS.map((w) => w.id).join("|")}> [--yes]`);
  process.exit(2);
}
const yes = argv.includes("--yes");
const { checkDayBudget } = await import("../src/runtime/budget");
const budget = await checkDayBudget();
if (!budget.ok) {
  console.error(budget.message);
  process.exit(3);
}
const run = startRun({ workstreamId: ws.id, title: ws.title, goal: ws.goal, trigger: "job", mode: yes ? "auto-low" : "ask", tools: ws.tools });
console.log(`job ${run.id} · ${ws.title} · model ${process.env.NIMBUS_MODEL ?? "(auto)"}`);
const act = (e: (typeof run.events)[number]) => {
  if (e.type === "approval.request") {
    const ok = yes && e.payload.action.risk === "low";
    console.log(`  approval (${e.payload.action.risk}) "${e.payload.action.summary}" → ${ok ? "approved" : "rejected: needs a person"}`);
    run.resolveApproval(e.payload.approvalId, { decision: ok ? "approved" : "rejected", note: ok ? undefined : "Needs a person: rerun from the web composer." });
  }
  if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[0] ?? "Use your best judgment.", questionId: e.payload.questionId });
  if (e.type === "run.end") console.log(`  run.end ${e.payload.status}`);
};
for (const e of run.events) act(e);
run.onEvent(act);
await run.settled;
const v = buildView(run.events);
console.log(`job finished · ${v.tokens.toLocaleString("en-US")} tokens · ${fmtCost(v.costUsd)} · ${v.lanes.length} lanes`);
process.exit(v.status === "done" ? 0 : 1);
