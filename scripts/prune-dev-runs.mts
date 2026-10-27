// Dev hygiene: removes the runs that test scripts and long-dead servers left in the shared database, after copying the
// database file next to itself. Targets: runs of workstream ids that no longer exist (ws-mezo, ws-inbox) and runs from
// before the `model` column existed (model IS NULL), with their events, approvals and artifacts. Seeded history, the
// seeded radar run and every mock/real run since the column was added stay.
//   pnpm prune:runs            (dry: prints what it would remove)       pnpm prune:runs --yes
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { dataDir, getDb } from "../src/db";

const yes = process.argv.includes("--yes");
const db = await getDb();
const sql = async (s: string) => (await (db as unknown as { $client: { execute: (q: string) => Promise<{ rows: Record<string, unknown>[] }> } }).$client.execute(s)).rows;
const WHERE = "(workstream_id IN ('ws-mezo','ws-inbox') OR model IS NULL) AND id NOT LIKE 'run_hist_%' AND id NOT LIKE 'run_seed_%'";
const [{ n }] = await sql(`SELECT count(*) n FROM runs WHERE ${WHERE}`);
const [{ total }] = await sql("SELECT count(*) total FROM runs");
console.log(`${n} of ${total} runs match (legacy workstreams, or recorded before the model column)`);
if (!yes) (console.log("dry run: nothing removed. Pass --yes to prune."), process.exit(0));
await sql("PRAGMA wal_checkpoint(TRUNCATE)");
const file = path.join(dataDir(), "nimbus.db");
const backup = path.join(dataDir(), `nimbus.before-prune-${Date.now()}.db`);
if (existsSync(file)) copyFileSync(file, backup);
console.log(`backup: ${path.relative(process.cwd(), backup)}`);
await sql(`DELETE FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE ${WHERE})`);
await sql(`DELETE FROM approvals WHERE run_id IN (SELECT id FROM runs WHERE ${WHERE})`);
await sql(`DELETE FROM artifacts WHERE run_id IN (SELECT id FROM runs WHERE ${WHERE})`);
await sql(`DELETE FROM runs WHERE ${WHERE}`);
const [{ left }] = await sql("SELECT count(*) \"left\" FROM runs");
console.log(`removed ${n}; ${left} runs left`);
process.exit(0);
