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
  `CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, workstream_id TEXT NOT NULL, title TEXT NOT NULL, goal TEXT NOT NULL, status TEXT NOT NULL, trigger TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, tokens_in INTEGER NOT NULL DEFAULT 0, tokens_out INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0, baseline_usd REAL NOT NULL DEFAULT 0, model TEXT)`,
  `CREATE TABLE IF NOT EXISTS run_events (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, seq INTEGER NOT NULL, t_ms INTEGER NOT NULL, agent TEXT NOT NULL, agent_instance TEXT NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS run_events_run_t ON run_events (run_id, t_ms)`,
  `CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, artifact_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL, language TEXT, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, action TEXT NOT NULL, status TEXT NOT NULL, always INTEGER NOT NULL DEFAULT 0, note TEXT, decided_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, workstream_id TEXT NOT NULL, text TEXT NOT NULL, embedding TEXT NOT NULL, source_run_id TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS skills (workstream_id TEXT PRIMARY KEY, content TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, previous TEXT, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS policies (workstream_id TEXT NOT NULL, rule TEXT NOT NULL, source_run_id TEXT, created_at INTEGER NOT NULL, used_count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (workstream_id, rule))`,
  `CREATE TABLE IF NOT EXISTS llm_cache (key TEXT PRIMARY KEY, model TEXT NOT NULL, response TEXT NOT NULL, usage TEXT NOT NULL, created_at INTEGER NOT NULL)`,
];

/** Several processes (dev server, cron, CLI, evals) share one SQLite file: retry a few times on lock contention. */
export async function retryBusy<T>(fn: () => Promise<T>, tries = 12): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const busy = /SQLITE_BUSY|database is locked/i.test(String((e as { message?: string })?.message ?? e));
      if (!busy || i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 150 + i * 120));
    }
  }
}

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
  const ready = retryBusy(async () => {
    // The dev server, the CLI and the evals can open the same file: wait for locks instead of failing, and allow readers beside a writer.
    await client.execute("PRAGMA busy_timeout = 8000");
    await client.execute("PRAGMA journal_mode = WAL").catch(() => {});
    for (const sql of DDL) await client.execute(sql);
    // Columns added after the first release: alter only when missing (an ALTER takes a write lock even when it is a no-op).
    const has = async (table: string, col: string) => (await client.execute(`PRAGMA table_info(${table})`)).rows.some((r) => r.name === col);
    if (!(await has("skills", "previous"))) await client.execute("ALTER TABLE skills ADD COLUMN previous TEXT");
    if (!(await has("skills", "updated_run_id"))) await client.execute("ALTER TABLE skills ADD COLUMN updated_run_id TEXT");
    if (!(await has("memories", "used_count"))) await client.execute("ALTER TABLE memories ADD COLUMN used_count INTEGER NOT NULL DEFAULT 0");
    if (!(await has("runs", "model"))) await client.execute("ALTER TABLE runs ADD COLUMN model TEXT");
    // Runs live in memory. A run still marked running after the 5 minute wall-clock cap belonged to a process that is
    // gone. Younger ones may be alive in another process (dev server, cron), so they are left alone.
    await client.execute({ sql: "UPDATE runs SET status = 'interrupted' WHERE status = 'running' AND started_at < ?", args: [Date.now() - 6 * 60_000] });
    await seedWorkstreams(db);
  });
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
