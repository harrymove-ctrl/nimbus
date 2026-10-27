// Records one run of a workstream (mock model, real delays) into fixtures/seed-runs/<name>.json, the file
// seedWorkstreams() inserts so the app opens with a finished run. Usage: pnpm seed:run ws-radar radar [cron|manual]
process.env.NIMBUS_DATA_DIR = "./data/seed-run"; // own database; .env.local already names ./data
process.env.NIMBUS_MODEL = "mock";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { dataDir, getDb, schema } from "../src/db";
import { WORKSTREAMS } from "../src/lib/workstreams";
import type { AnyRunEvent } from "../src/lib/events";
import { startRun } from "../src/runtime/source";

const [wsId, name, trigger = "cron"] = process.argv.slice(2);
const w = WORKSTREAMS.find((x) => x.id === wsId);
if (!w || !name) (console.error("usage: pnpm seed:run <workstream id> <file name> [cron|manual]"), process.exit(2));
rmSync(dataDir(), { recursive: true, force: true }); // a clean database: the seed policy line is the only history

const run = startRun({ workstreamId: w.id, title: w.title, goal: w.goal, trigger: trigger as "cron" | "manual" });
const act = (e: AnyRunEvent) => {
  if (e.type === "approval.request") run.resolveApproval(e.payload.approvalId, { decision: "approved" });
  if (e.type === "question") run.postMessage({ kind: "answer", text: e.payload.options?.[0] ?? "ok", questionId: e.payload.questionId });
};
for (const e of run.events) act(e);
run.onEvent(act);
await run.settled;

const db = await getDb();
const [r] = await db.select().from(schema.runs).where(eq(schema.runs.id, run.id));
const events = await db.select().from(schema.runEvents).where(eq(schema.runEvents.runId, run.id)).orderBy(asc(schema.runEvents.seq));
const arts = await db.select().from(schema.artifacts).where(eq(schema.artifacts.runId, run.id));
const id = `run_seed_${name}`;
const seed = {
  workstreamId: w.id,
  run: { id, title: r.title, goal: r.goal, status: r.status, trigger: r.trigger, endMs: Math.max(...events.map((e) => e.tMs)) + 400, tokensIn: r.tokensIn, tokensOut: r.tokensOut, costUsd: r.costUsd, baselineUsd: r.baselineUsd, model: r.model ?? "mock" },
  events: events.map((e) => ({ tMs: e.tMs, agent: e.agent, agentInstance: e.agentInstance, type: e.type, payload: e.payload })),
  artifacts: arts.map((a) => ({ artifactId: a.artifactId, kind: a.kind, title: a.title, version: a.version, content: a.content, language: a.language })),
};
// events carry the recorded run id in their payloads only through ids we do not store; nothing to rewrite
mkdirSync(path.join(process.cwd(), "fixtures", "seed-runs"), { recursive: true });
writeFileSync(path.join(process.cwd(), "fixtures", "seed-runs", `${name}.json`), JSON.stringify(seed, null, 1) + "\n");
console.log(`${name}: status ${r.status} · ${events.length} events · ${arts.length} artifact version(s) · $${r.costUsd.toFixed(4)} · ${(seed.run.endMs / 1000).toFixed(1)} s`);
process.exit(0);
