// SPEC §5 + §12: SQLite via libsql + drizzle. Tables are created by ensureSchema() in ./index.ts.
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workstreams = sqliteTable("workstreams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  scheduleCron: text("schedule_cron"),
  scheduleLabel: text("schedule_label"),
  tools: text("tools", { mode: "json" }).$type<string[]>().notNull(),
  unread: integer("unread").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  workstreamId: text("workstream_id").notNull(),
  title: text("title").notNull(),
  goal: text("goal").notNull(),
  status: text("status").notNull(),
  trigger: text("trigger").notNull(),
  startedAt: integer("started_at").notNull(),
  endedAt: integer("ended_at"),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  baselineUsd: real("baseline_usd").notNull().default(0),
});

export const runEvents = sqliteTable(
  "run_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    seq: integer("seq").notNull(),
    tMs: integer("t_ms").notNull(),
    agent: text("agent").notNull(),
    agentInstance: text("agent_instance").notNull(),
    type: text("type").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
  },
  (t) => [index("run_events_run_t").on(t.runId, t.tMs)],
);

export const artifacts = sqliteTable("artifacts", {
  id: text("id").primaryKey(), // `${runId}:${artifactId}:v${version}`
  runId: text("run_id").notNull(),
  artifactId: text("artifact_id").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  language: text("language"),
  createdAt: integer("created_at").notNull(),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  action: text("action", { mode: "json" }).notNull(),
  status: text("status").notNull(),
  always: integer("always").notNull().default(0),
  note: text("note"),
  decidedAt: integer("decided_at"),
});

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  workstreamId: text("workstream_id").notNull(),
  text: text("text").notNull(),
  embedding: text("embedding", { mode: "json" }).$type<number[]>().notNull(),
  sourceRunId: text("source_run_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const skills = sqliteTable("skills", {
  workstreamId: text("workstream_id").primaryKey(),
  content: text("content").notNull(),
  version: integer("version").notNull().default(1),
  updatedAt: integer("updated_at").notNull(),
});

/** Exact-match response cache (SPEC §12): sha256(model + messages + tools), 24 h TTL. */
export const llmCache = sqliteTable("llm_cache", {
  key: text("key").primaryKey(),
  model: text("model").notNull(),
  response: text("response", { mode: "json" }).notNull(),
  usage: text("usage", { mode: "json" }).notNull(),
  createdAt: integer("created_at").notNull(),
});
