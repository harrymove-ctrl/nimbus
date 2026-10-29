// Removes the demo seed from a database that now runs on the real models, after copying the database file next to
// itself: the seeded history (run_hist_*), the recorded runs (run_seed_*) with their events, approvals and artifacts,
// memories learned from those runs, and the policy rows written from the seed SKILL.md text (source run NULL). Rules a
// person saved during a run keep their source run and stay; the rule lines in SKILL.md stay too (they are configuration).
// Every other run, memory and policy stays.
//   pnpm prune:seed            (dry: prints what it would remove)       pnpm prune:seed --yes
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dataDir, getDb, seedPolicyLines } from "../src/db";
import { WORKSTREAMS } from "../src/lib/workstreams";

const yes = process.argv.includes("--yes");
const db = await getDb();
type Row = Record<string, unknown>;
const client = (db as unknown as { $client: { execute: (q: string | { sql: string; args: unknown[] }) => Promise<{ rows: Row[] }> } }).$client;
const sql = async (s: string, args: unknown[] = []) => (await client.execute({ sql: s, args })).rows;
const count = async (s: string, args: unknown[] = []) => Number((await sql(`SELECT count(*) n FROM ${s}`, args))[0].n);

const SEED_RUNS = "(id LIKE 'run_hist_%' OR id LIKE 'run_seed_%')";
const IN_SEED = `IN (SELECT id FROM runs WHERE ${SEED_RUNS})`;
const seedRules = WORKSTREAMS.flatMap((w) => seedPolicyLines(w.skill).map((rule) => [w.id, rule] as const));
const POLICY = `(source_run_id ${IN_SEED}${seedRules.length ? ` OR (source_run_id IS NULL AND (${seedRules.map(() => "(workstream_id = ? AND rule = ?)").join(" OR ")}))` : ""})`;
const policyArgs = seedRules.flat();

const plan = {
  runs: await count(`runs WHERE ${SEED_RUNS}`),
  run_events: await count(`run_events WHERE run_id ${IN_SEED}`),
  approvals: await count(`approvals WHERE run_id ${IN_SEED}`),
  artifacts: await count(`artifacts WHERE run_id ${IN_SEED}`),
  memories: await count(`memories WHERE source_run_id ${IN_SEED}`),
  policies: await count(`policies WHERE ${POLICY}`, policyArgs),
  skillsPointingAtSeed: await count(`skills WHERE updated_run_id ${IN_SEED}`),
};
const keep = {
  runs: (await count("runs")) - plan.runs,
  memories: (await count("memories")) - plan.memories,
  policies: (await count("policies")) - plan.policies,
};
console.log("would remove:", JSON.stringify(plan));
console.log("would keep:  ", JSON.stringify(keep));
for (const r of await sql(`SELECT workstream_id, rule, source_run_id FROM policies WHERE ${POLICY}`, policyArgs)) console.log(`  policy  ${r.workstream_id}: ${r.rule}${r.source_run_id ? ` (from ${r.source_run_id})` : ""}`);
for (const r of await sql(`SELECT id, workstream_id, model, status FROM runs WHERE NOT ${SEED_RUNS} ORDER BY started_at`)) console.log(`  keep run ${r.id} ${r.workstream_id} ${r.model ?? "?"} ${r.status}`);
if (!yes) {
  console.log("dry run: nothing removed. Pass --yes to prune.");
  process.exit(0);
}

await sql("PRAGMA wal_checkpoint(TRUNCATE)");
const file = path.join(dataDir(), "nimbus.db");
const backup = path.join(dataDir(), `nimbus.before-prune-seed-${Date.now()}.db`);
if (existsSync(file)) copyFileSync(file, backup);
console.log(`backup: ${path.relative(process.cwd(), backup)}`);
await sql(`DELETE FROM policies WHERE ${POLICY}`, policyArgs);
await sql(`DELETE FROM memories WHERE source_run_id ${IN_SEED}`);
await sql(`UPDATE skills SET updated_run_id = NULL WHERE updated_run_id ${IN_SEED}`);
await sql(`DELETE FROM run_events WHERE run_id ${IN_SEED}`);
await sql(`DELETE FROM approvals WHERE run_id ${IN_SEED}`);
await sql(`DELETE FROM artifacts WHERE run_id ${IN_SEED}`);
await sql(`DELETE FROM runs WHERE ${SEED_RUNS}`);
console.log(`removed ${plan.runs} runs; ${await count("runs")} runs, ${await count("memories")} memories, ${await count("policies")} policies left`);
process.exit(0);
