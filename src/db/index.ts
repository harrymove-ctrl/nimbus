import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { WORKSTREAMS } from "@/lib/workstreams";

export { schema };

export const dataDir = () => path.resolve(process.env.NIMBUS_DATA_DIR || "./data");

const DDL = [
  `CREATE TABLE IF NOT EXISTS workstreams (id TEXT PRIMARY KEY, title TEXT NOT NULL, goal TEXT NOT NULL, schedule_cron TEXT, schedule_label TEXT, tools TEXT NOT NULL, unread INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, workstream_id TEXT NOT NULL, title TEXT NOT NULL, goal TEXT NOT NULL, status TEXT NOT NULL, trigger TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0, baseline_usd REAL NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS run_events (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, seq INTEGER NOT NULL, t_ms INTEGER NOT NULL, agent TEXT NOT NULL, agent_instance TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS run_events_run_t ON run_events (run_id, t_ms)`,
  `CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, artifact_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL, language TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL, always INTEGER NOT NULL DEFAULT 0, note TEXT, decided_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, workstream_id TEXT NOT NULL, text TEXT NOT NULL, embedding TEXT NOT NULL, source_run_id TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS skills (workstream_id TEXT PRIMARY KEY, content TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, previous TEXT, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS llm_cache (key TEXT PRIMARY KEY, model TEXT NOT NULL, response TEXT NOT NULL, usage TEXT NOT NULL, created_at INTEGER NOT NULL)`,
];

export type Db = LibSQLDatabase<typeof schema>;
type Holder = { client: Client; db: Db; ready: Promise<void> };

declare global {
  var __nimbusDb: Holder | undefined;
}

function open(): Holder {
  const dir = dataDir();
  mkdirSync(dir, { recursive: true });
  const client = createClient({ url: `file:${path.join(dir, "nimbus.db")}` });
  const db = drizzle(client, { schema });
  const ready = (async () => {
    for (const sql of DDL) await client.execute(sql);
    await client.execute("ALTER TABLE skills ADD COLUMN previous TEXT").catch(() => {}); // databases created before this column
    // Runs are in-memory; a run still marked running belonged to a process that is gone.
    await client.execute("UPDATE runs SET status = 'interrupted' WHERE status = 'running'");
    await seedWorkstreams(db);
  })();
  return { client, db, ready };
}

/** Singleton (survives Next.js HMR). Await the returned db: tables exist and workstreams are seeded. */
export async function getDb(): Promise<Db> {
  const h = (globalThis.__nimbusDb ??= open());
  await h.ready;
  return h.db;
}

/** Seeds the three workstreams and their SKILL.md once (fixtures/seed.ts calls this too). */
export async function seedWorkstreams(db: Db) {
  for (const w of WORKSTREAMS) {
    const exists = await db.select({ id: schema.workstreams.id }).from(schema.workstreams).where(eq(schema.workstreams.id, w.id));
    if (exists.length) continue;
    await db.insert(schema.workstreams).values({
      id: w.id,
      title: w.title,
      goal: w.goal,
      scheduleCron: w.scheduleCron ?? null,
      scheduleLabel: w.scheduleLabel ?? null,
      tools: w.tools,
      unread: w.unread ? 1 : 0,
      createdAt: Date.now(),
    });
    await db.insert(schema.skills).values({ workstreamId: w.id, content: w.skill, version: 1, updatedAt: Date.now() });
  }
}
